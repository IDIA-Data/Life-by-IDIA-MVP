## Problem

Motions in `CommitteeWorkspace` (Delaware → Motion Threads) still appear with `active` / `active_vote` status even after they've reached 3/3 endorsements or been rejected. Those outcomes are already recorded in the DUNA archive spaces, so the Motion Threads list should only show motions that are still awaiting a decision.

## Fix

Filter the ledger in `src/components/governance/CommitteeWorkspace.tsx` so a motion only appears while it is still "in deliberation":

1. When loading proposals for the selected committee, also pull each proposal's `proposal_signatures` (endorse / object counts) in the same query.
2. Derive `requiredEndorsements` from committee size (same rule already used in `MotionThread.tsx` — quorum of active committee hats, capped at 3).
3. Exclude a proposal from the list when **any** of these is true:
   - `endorse_count >= requiredEndorsements` (fully endorsed → escalated / archived)
   - `object_count >= requiredEndorsements` (rejected → archived)
   - `lifecycle_phase` / `status` is one of: `escalated`, `on_chain`, `rejected`, `withdrawn`, `archived`, `defeated`, `succeeded`, `executed`, `canceled`
4. Keep the 15s heartbeat so a motion drops out of the list within one tick of hitting threshold.
5. No schema change, no edge-function change, no changes to archive views (they already show these).

## Technical notes

- Add a small helper `isMotionResolved(prop, sigs, requiredEndorsements)` co-located in `CommitteeWorkspace.tsx`.
- Fetch signatures via a second `proposal_signatures` query keyed by the returned proposal ids (avoids relying on a FK-embed that may not exist in generated types).
- `MotionThread.tsx` itself is untouched — it still renders correctly if opened directly, but resolved motions simply won't be listed anymore.
