BEGIN;

-- 1. Clean up the duplicate 24h pending_veto row (kept the 72h canonical row).
UPDATE public.dao_hats
SET revoked_at = now(),
    eligibility_status = 'revoked'
WHERE id = '8f01c116-e840-42e3-8102-3b21a467cd35'
  AND revoked_at IS NULL;

-- 2. Defensive sweep: for any (user_id, hat_type) with >1 live row, keep the
--    earliest and revoke the rest. Guarantees the unique index can be built.
WITH ranked AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY user_id, hat_type
           ORDER BY created_at ASC, id ASC
         ) AS rn
  FROM public.dao_hats
  WHERE revoked_at IS NULL
    AND eligibility_status IN ('pending_veto','active')
)
UPDATE public.dao_hats h
SET revoked_at = now(),
    eligibility_status = 'revoked'
FROM ranked r
WHERE h.id = r.id
  AND r.rn > 1;

-- 3. Prevent duplicate live hats per (user, hat_type) at the DB level.
CREATE UNIQUE INDEX IF NOT EXISTS dao_hats_one_live_hat_per_user_committee
ON public.dao_hats (user_id, hat_type)
WHERE revoked_at IS NULL
  AND eligibility_status IN ('pending_veto','active');

COMMIT;