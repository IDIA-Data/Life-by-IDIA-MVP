
-- ============================================================
-- TIER 3 GOVERNANCE SCHEMA
-- ============================================================

-- 1. dao_proposals: committee + escalation fields
ALTER TABLE public.dao_proposals
  ADD COLUMN IF NOT EXISTS committee_id text,
  ADD COLUMN IF NOT EXISTS escalated_at timestamptz,
  ADD COLUMN IF NOT EXISTS escalated_by uuid,
  ADD COLUMN IF NOT EXISTS committee_quorum_required int DEFAULT 3;

-- 2. dao_hats: last_attested_at for renewal flow
ALTER TABLE public.dao_hats
  ADD COLUMN IF NOT EXISTS last_attested_at timestamptz;
UPDATE public.dao_hats SET last_attested_at = granted_at WHERE last_attested_at IS NULL;
ALTER TABLE public.dao_hats ALTER COLUMN last_attested_at SET DEFAULT now();

-- 3. committee_application_sponsorships: one endorsement per officer per app
ALTER TABLE public.committee_application_sponsorships
  DROP CONSTRAINT IF EXISTS uq_sponsorship_app_sponsor;
ALTER TABLE public.committee_application_sponsorships
  ADD CONSTRAINT uq_sponsorship_app_sponsor UNIQUE (application_id, sponsor_user_id);

-- 4. proposal_comments
CREATE TABLE IF NOT EXISTS public.proposal_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id uuid NOT NULL REFERENCES public.dao_proposals(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES public.proposal_comments(id) ON DELETE CASCADE,
  author_id uuid NOT NULL,
  body text NOT NULL,
  aca_hash_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  edited_at timestamptz,
  redacted_at timestamptz
);
GRANT SELECT, INSERT, UPDATE ON public.proposal_comments TO authenticated;
GRANT ALL ON public.proposal_comments TO service_role;
ALTER TABLE public.proposal_comments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated can read proposal comments" ON public.proposal_comments;
CREATE POLICY "Authenticated can read proposal comments"
  ON public.proposal_comments FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Authors insert their own comments" ON public.proposal_comments;
CREATE POLICY "Authors insert their own comments"
  ON public.proposal_comments FOR INSERT TO authenticated WITH CHECK (author_id = auth.uid());
DROP POLICY IF EXISTS "Authors edit their own comments" ON public.proposal_comments;
CREATE POLICY "Authors edit their own comments"
  ON public.proposal_comments FOR UPDATE TO authenticated USING (author_id = auth.uid());
CREATE INDEX IF NOT EXISTS idx_proposal_comments_proposal ON public.proposal_comments(proposal_id, created_at);

-- 5. proposal_signatures (committee quorum)
CREATE TABLE IF NOT EXISTS public.proposal_signatures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id uuid NOT NULL REFERENCES public.dao_proposals(id) ON DELETE CASCADE,
  signer_id uuid NOT NULL,
  signature_type text NOT NULL CHECK (signature_type IN ('endorse','object')),
  aca_hash_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (proposal_id, signer_id)
);
GRANT SELECT, INSERT ON public.proposal_signatures TO authenticated;
GRANT ALL ON public.proposal_signatures TO service_role;
ALTER TABLE public.proposal_signatures ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated can read signatures" ON public.proposal_signatures;
CREATE POLICY "Authenticated can read signatures"
  ON public.proposal_signatures FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Signers insert their own signatures" ON public.proposal_signatures;
CREATE POLICY "Signers insert their own signatures"
  ON public.proposal_signatures FOR INSERT TO authenticated WITH CHECK (signer_id = auth.uid());
CREATE INDEX IF NOT EXISTS idx_proposal_signatures_proposal ON public.proposal_signatures(proposal_id);

-- 6. hat_recall_petitions
CREATE TABLE IF NOT EXISTS public.hat_recall_petitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_hat_id uuid NOT NULL REFERENCES public.dao_hats(id) ON DELETE CASCADE,
  petitioner_id uuid NOT NULL,
  reason text NOT NULL,
  aca_hash_key text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','passed','failed','withdrawn')),
  threshold int NOT NULL DEFAULT 3,
  signature_count int NOT NULL DEFAULT 0,
  opened_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_open_petition_per_hat
  ON public.hat_recall_petitions(target_hat_id) WHERE status = 'open';
GRANT SELECT, INSERT, UPDATE ON public.hat_recall_petitions TO authenticated;
GRANT ALL ON public.hat_recall_petitions TO service_role;
ALTER TABLE public.hat_recall_petitions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated can read petitions" ON public.hat_recall_petitions;
CREATE POLICY "Authenticated can read petitions"
  ON public.hat_recall_petitions FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Petitioner opens petition" ON public.hat_recall_petitions;
CREATE POLICY "Petitioner opens petition"
  ON public.hat_recall_petitions FOR INSERT TO authenticated WITH CHECK (petitioner_id = auth.uid());
DROP POLICY IF EXISTS "Petitioner withdraws own petition" ON public.hat_recall_petitions;
CREATE POLICY "Petitioner withdraws own petition"
  ON public.hat_recall_petitions FOR UPDATE TO authenticated USING (petitioner_id = auth.uid());

-- 7. hat_recall_signatures
CREATE TABLE IF NOT EXISTS public.hat_recall_signatures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  petition_id uuid NOT NULL REFERENCES public.hat_recall_petitions(id) ON DELETE CASCADE,
  signer_id uuid NOT NULL,
  aca_hash_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (petition_id, signer_id)
);
GRANT SELECT, INSERT ON public.hat_recall_signatures TO authenticated;
GRANT ALL ON public.hat_recall_signatures TO service_role;
ALTER TABLE public.hat_recall_signatures ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated can read recall signatures" ON public.hat_recall_signatures;
CREATE POLICY "Authenticated can read recall signatures"
  ON public.hat_recall_signatures FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Signers sign their own" ON public.hat_recall_signatures;
CREATE POLICY "Signers sign their own"
  ON public.hat_recall_signatures FOR INSERT TO authenticated WITH CHECK (signer_id = auth.uid());

-- 8. governance_ledger: add structured audit columns
ALTER TABLE public.governance_ledger
  ADD COLUMN IF NOT EXISTS actor_id uuid,
  ADD COLUMN IF NOT EXISTS action_type text,
  ADD COLUMN IF NOT EXISTS target_table text,
  ADD COLUMN IF NOT EXISTS target_id uuid,
  ADD COLUMN IF NOT EXISTS aca_hash_key text,
  ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;
GRANT SELECT ON public.governance_ledger TO authenticated;
GRANT ALL ON public.governance_ledger TO service_role;
ALTER TABLE public.governance_ledger ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated can read governance ledger" ON public.governance_ledger;
CREATE POLICY "Authenticated can read governance ledger"
  ON public.governance_ledger FOR SELECT TO authenticated USING (true);
CREATE INDEX IF NOT EXISTS idx_ledger_actor ON public.governance_ledger(actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ledger_target ON public.governance_ledger(target_table, target_id);
CREATE INDEX IF NOT EXISTS idx_ledger_created_desc ON public.governance_ledger(created_at DESC);

-- 9. Generic ledger-writer
CREATE OR REPLACE FUNCTION public.write_governance_ledger()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_actor uuid;
  v_aca text;
  v_action text;
  v_target_id uuid;
  v_meta jsonb := '{}'::jsonb;
BEGIN
  v_action := TG_TABLE_NAME || ':' || TG_OP;
  v_target_id := COALESCE((to_jsonb(NEW)->>'id')::uuid, (to_jsonb(OLD)->>'id')::uuid);
  v_actor := COALESCE(
    (to_jsonb(NEW)->>'author_id')::uuid,
    (to_jsonb(NEW)->>'signer_id')::uuid,
    (to_jsonb(NEW)->>'petitioner_id')::uuid,
    (to_jsonb(NEW)->>'sponsor_user_id')::uuid,
    (to_jsonb(NEW)->>'proposer_id')::uuid,
    (to_jsonb(NEW)->>'user_id')::uuid,
    (to_jsonb(NEW)->>'provisioned_by')::uuid
  );
  v_aca := COALESCE(
    to_jsonb(NEW)->>'aca_hash_key',
    to_jsonb(NEW)->>'sponsor_aca_hash',
    to_jsonb(NEW)->>'veto_aca_hash'
  );
  IF TG_OP = 'UPDATE' THEN
    v_meta := jsonb_build_object(
      'status_old', to_jsonb(OLD)->>'status',
      'status_new', to_jsonb(NEW)->>'status',
      'eligibility_old', to_jsonb(OLD)->>'eligibility_status',
      'eligibility_new', to_jsonb(NEW)->>'eligibility_status',
      'lifecycle_old', to_jsonb(OLD)->>'lifecycle_phase',
      'lifecycle_new', to_jsonb(NEW)->>'lifecycle_phase'
    );
  END IF;
  INSERT INTO public.governance_ledger
    (actor_id, action_type, target_table, target_id, aca_hash_key, metadata, description)
  VALUES
    (v_actor, v_action, TG_TABLE_NAME, v_target_id, v_aca, v_meta, v_action);
  RETURN COALESCE(NEW, OLD);
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[write_governance_ledger] failed: %', SQLERRM;
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- 10. Ledger triggers
DROP TRIGGER IF EXISTS trg_ledger_committee_apps ON public.committee_applications;
CREATE TRIGGER trg_ledger_committee_apps AFTER INSERT OR UPDATE ON public.committee_applications
  FOR EACH ROW EXECUTE FUNCTION public.write_governance_ledger();

DROP TRIGGER IF EXISTS trg_ledger_sponsorships ON public.committee_application_sponsorships;
CREATE TRIGGER trg_ledger_sponsorships AFTER INSERT ON public.committee_application_sponsorships
  FOR EACH ROW EXECUTE FUNCTION public.write_governance_ledger();

DROP TRIGGER IF EXISTS trg_ledger_hats ON public.dao_hats;
CREATE TRIGGER trg_ledger_hats AFTER INSERT OR UPDATE ON public.dao_hats
  FOR EACH ROW EXECUTE FUNCTION public.write_governance_ledger();

DROP TRIGGER IF EXISTS trg_ledger_proposals ON public.dao_proposals;
CREATE TRIGGER trg_ledger_proposals AFTER INSERT OR UPDATE ON public.dao_proposals
  FOR EACH ROW EXECUTE FUNCTION public.write_governance_ledger();

DROP TRIGGER IF EXISTS trg_ledger_votes ON public.dao_votes;
CREATE TRIGGER trg_ledger_votes AFTER INSERT ON public.dao_votes
  FOR EACH ROW EXECUTE FUNCTION public.write_governance_ledger();

DROP TRIGGER IF EXISTS trg_ledger_vetoes ON public.dao_vetoes;
CREATE TRIGGER trg_ledger_vetoes AFTER INSERT ON public.dao_vetoes
  FOR EACH ROW EXECUTE FUNCTION public.write_governance_ledger();

DROP TRIGGER IF EXISTS trg_ledger_comments ON public.proposal_comments;
CREATE TRIGGER trg_ledger_comments AFTER INSERT ON public.proposal_comments
  FOR EACH ROW EXECUTE FUNCTION public.write_governance_ledger();

DROP TRIGGER IF EXISTS trg_ledger_signatures ON public.proposal_signatures;
CREATE TRIGGER trg_ledger_signatures AFTER INSERT ON public.proposal_signatures
  FOR EACH ROW EXECUTE FUNCTION public.write_governance_ledger();

DROP TRIGGER IF EXISTS trg_ledger_recall_petitions ON public.hat_recall_petitions;
CREATE TRIGGER trg_ledger_recall_petitions AFTER INSERT OR UPDATE ON public.hat_recall_petitions
  FOR EACH ROW EXECUTE FUNCTION public.write_governance_ledger();

DROP TRIGGER IF EXISTS trg_ledger_recall_signatures ON public.hat_recall_signatures;
CREATE TRIGGER trg_ledger_recall_signatures AFTER INSERT ON public.hat_recall_signatures
  FOR EACH ROW EXECUTE FUNCTION public.write_governance_ledger();

-- 11. Auto-promote sponsored application (3+ endorsements)
CREATE OR REPLACE FUNCTION public.auto_promote_sponsored_application()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_app RECORD;
BEGIN
  UPDATE public.committee_applications
    SET sponsor_count = COALESCE(sponsor_count,0) + 1
    WHERE id = NEW.application_id
    RETURNING * INTO v_app;

  IF v_app.status = 'pending' AND v_app.sponsor_count >= 3 THEN
    UPDATE public.committee_applications
      SET status = 'approved'
      WHERE id = v_app.id AND status = 'pending';

    IF NOT EXISTS (
      SELECT 1 FROM public.dao_hats
      WHERE user_id = v_app.user_id
        AND hat_type = v_app.committee_id
        AND revoked_at IS NULL
        AND eligibility_status IN ('pending_veto','active')
    ) THEN
      INSERT INTO public.dao_hats
        (user_id, hat_type, eligibility_status, veto_window_end, provisioned_by)
      VALUES
        (v_app.user_id, v_app.committee_id, 'pending_veto', now() + interval '72 hours', NEW.sponsor_user_id);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_promote_sponsorship ON public.committee_application_sponsorships;
CREATE TRIGGER trg_auto_promote_sponsorship AFTER INSERT ON public.committee_application_sponsorships
  FOR EACH ROW EXECUTE FUNCTION public.auto_promote_sponsored_application();

-- 12. Recall signature threshold
CREATE OR REPLACE FUNCTION public.recall_signature_threshold()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_pet RECORD;
BEGIN
  UPDATE public.hat_recall_petitions
    SET signature_count = signature_count + 1
    WHERE id = NEW.petition_id
    RETURNING * INTO v_pet;

  IF v_pet.status = 'open' AND v_pet.signature_count >= v_pet.threshold THEN
    UPDATE public.hat_recall_petitions
      SET status = 'passed', closed_at = now()
      WHERE id = v_pet.id;
    UPDATE public.dao_hats
      SET eligibility_status = 'recalled', revoked_at = now()
      WHERE id = v_pet.target_hat_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_recall_threshold ON public.hat_recall_signatures;
CREATE TRIGGER trg_recall_threshold AFTER INSERT ON public.hat_recall_signatures
  FOR EACH ROW EXECUTE FUNCTION public.recall_signature_threshold();
