
## Authority of Record (AoR) Consent Flow

Add a second, biometric-gated consent screen that runs immediately after the user accepts the Terms of Service. Choice (Authorize or Decline) is recorded in a new consent-registry table, mirrored into `user_aca_records`, and stamped on `auth.user_metadata`.

### 1. Database — new registry table

Migration to create `public.consent_registry`:

- `id uuid pk`, `user_id uuid` (references auth.users via id, no FK), `consent_type text` (e.g. `TOS_V1`, `AUTHORITY_OF_RECORD_V1`), `decision text` (`accepted` | `declined`), `document_version text`, `aca_hash_key text`, `payload jsonb`, `created_at timestamptz default now()`
- Unique index on `(user_id, consent_type, document_version)` so a decision is captured once per version (updatable via new row on version bump)
- GRANTs: `authenticated` = SELECT/INSERT own rows; `service_role` = ALL; no `anon`
- RLS: user can SELECT/INSERT rows where `user_id = auth.uid()`; no UPDATE/DELETE from clients
- Also backfill the existing ToS acceptance into `consent_registry` on the next accept (going forward only — no historical rewrite)

### 2. New page/modal — `AuthorityOfRecordConsent`

New route `/authority-of-record` (and component `src/pages/AuthorityOfRecord.tsx`), styled to match `TermsOfService.tsx` shell (glass card, gradient header, safe-area padding).

Content shown verbatim:

> **Authority of Record Authorization**
>
> To protect your digital identity from unauthorized surveillance, you have the option to appoint IDIA Data Inc. as your Authority of Record.
>
> By clicking 'Authorize', you are granting IDIA limited Power of Attorney to manage your digital identity assets and initiate legal claims on your behalf against entities that misappropriate them. This is an elective protection to ensure you are represented in the fight against mass surveillance.

Two mutually exclusive radio options:
- `I Authorize IDIA Data Inc. as my Authority of Record.`
- `I decline this protection.`

Single **Continue** button (disabled until one option is selected).

### 3. Biometric ACA capture

On Continue:
1. Call `generateACAHash(user.id, 'AUTHORITY_OF_RECORD_V1', ['AOR_AUTHORIZATION', decision === 'accepted' ? 'POA_GRANTED' : 'POA_DECLINED'])` — this triggers Face ID / Touch ID via the existing WKWebView bridge (same path used by ToS).
2. Insert into `consent_registry` with decision, version `v1`, `aca_hash_key`, and full payload.
3. Mirror into `user_aca_records` (same pattern as ToS).
4. Log a `device_events` row: `event_type='aor_consent_ack'`, payload includes decision + ACA.
5. `supabase.auth.updateUser({ data: { aor_decision, aor_decided_at, aor_version: 'v1' } })`.
6. Toast success and `navigate('/')`.

Failure of biometric bridge → same handling as ToS (`ACA_PROMPT_REJECTED` toast, stay on screen).

### 4. Routing — chain after ToS

`src/pages/TermsOfService.tsx`: after successful acceptance, replace `navigate('/')` with `navigate('/authority-of-record')`.

`src/App.tsx`: register the new route.

Gate in `src/pages/Index.tsx` / `MainApp`: if the authenticated user has `tos_accepted_at` but no `aor_decision` in `user_metadata`, redirect to `/authority-of-record` before rendering `MainApp`. This covers users who accepted ToS previously.

### 5. Non-goals

- No changes to ToS copy, ToS versioning, or existing ACA generator.
- Decline is a valid, permanent-for-this-version choice — user is not re-prompted unless we bump to `AUTHORITY_OF_RECORD_V2`.
- No change to smart contracts or edge functions.

### Technical summary

| Area | Change |
|---|---|
| DB | New `public.consent_registry` table + RLS + GRANTs |
| Frontend | New `AuthorityOfRecord.tsx` page, new `/authority-of-record` route, gate in `Index.tsx` |
| Flow | ToS accept → AoR screen → biometric ACA → registry insert + auth metadata → `/` |
| Reuse | `generateACAHash`, `user_aca_records`, `device_events`, existing styling primitives |
