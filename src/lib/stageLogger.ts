/**
 * Ultra-granular stage-trace logger.
 *
 * Every async path on the client must emit a [START] line and exactly one
 * terminal [END:OK] or [END:FAIL] line. This makes silent stalls (RPC hangs,
 * dropped fetches, hung promises) trivially visible during Apple App Store
 * review and live production monitoring.
 *
 * Usage:
 *   const s = stage("GOV_RELAY", "POST_REQUEST");
 *   s.start({ proposalId });
 *   try { ...; s.ok({ status: 200 }); }
 *   catch (e) { s.fail(e); throw e; }
 */
export interface StageTracer {
  start: (meta?: unknown) => void;
  ok: (meta?: unknown) => void;
  fail: (err: unknown) => void;
}

export const stage = (scope: string, name: string): StageTracer => ({
  start: (meta) => console.log(`[${scope}][${name}][START]`, meta ?? ""),
  ok: (meta) => console.log(`[${scope}][${name}][END:OK]`, meta ?? ""),
  fail: (err) =>
    console.error(
      `[${scope}][${name}][END:FAIL]`,
      err instanceof Error ? `${err.name}: ${err.message}` : err,
    ),
});
