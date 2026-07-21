import { useState, useEffect, useCallback, useRef } from 'react';
import { healthService } from '@/services/healthService';
import type { HealthSyncResult, HealthServiceStatus } from '@/services/healthService';
import { isNative } from '@/services/platform';
import { useProfile } from '@/hooks/useProfile';
import { supabase } from '@/integrations/supabase/client';

// Auto-sync threshold: matches the "synced recently" UI window (6 hours)
const STALE_THRESHOLD_MS = 6 * 60 * 60 * 1000;

export function useNativeHealth() {
  const [status, setStatus] = useState<HealthServiceStatus | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<HealthSyncResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { preferences } = useProfile();
  const healthAllowed = (preferences as any)?.privacy_health !== false;
  const autoSyncTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoSyncInFlight = useRef(false);

  useEffect(() => { healthService.getStatus().then(setStatus).catch(console.error); }, []);

  const blockedResult = (): HealthSyncResult => ({
    success: false,
    error: 'Health Kit is disabled in Privacy Settings',
    synced: false,
  });

  const requestPermissions = useCallback(async () => {
    setError(null);
    const granted = await healthService.requestPermissions();
    setStatus(await healthService.getStatus());
    return granted;
  }, []);

  const quickSync = useCallback(async () => {
    if (!healthAllowed) { const r = blockedResult(); setLastSync(r); setError(r.error!); return r; }
    setIsSyncing(true); setError(null);
    try {
      const r = await healthService.quickSync(); setLastSync(r);
      if (!r.success) setError(r.error || 'Sync failed');
      return r;
    } catch (e: any) {
      const r: HealthSyncResult = { success: false, error: e.message, synced: false };
      setLastSync(r); setError(e.message); return r;
    } finally { setIsSyncing(false); }
  }, [healthAllowed]);

  const fetchRange = useCallback(async (start: Date, end: Date) => {
    if (!healthAllowed) { const r = blockedResult(); setLastSync(r); setError(r.error!); return r; }
    setIsSyncing(true); setError(null);
    try {
      const r = await healthService.fetchAndSync(start, end, true); setLastSync(r);
      if (!r.success) setError(r.error || 'Fetch failed');
      return r;
    } catch (e: any) {
      const r: HealthSyncResult = { success: false, error: e.message, synced: false };
      setLastSync(r); setError(e.message); return r;
    } finally { setIsSyncing(false); }
  }, [healthAllowed]);

  // Periodic auto-sync: ensures Apple Health data does not go stale beyond the 6h window.
  // HealthKit only exists on-device, so the "trigger" must run in the client while the app is alive
  // (foregrounded or resumed). We check on mount, on visibility change, and every 6h via interval.
  const runIfStale = useCallback(async () => {
    if (!healthAllowed || !isNative()) return;
    if (autoSyncInFlight.current || isSyncing) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: conn } = await supabase
        .from('data_connections')
        .select('last_sync_at')
        .eq('user_id', user.id)
        .eq('connection_type', 'apple_health')
        .maybeSingle();
      const last = conn?.last_sync_at ? new Date(conn.last_sync_at).getTime() : 0;
      const stale = !last || (Date.now() - last) >= STALE_THRESHOLD_MS;
      if (!stale) return;
      autoSyncInFlight.current = true;
      const r = await healthService.quickSync();
      setLastSync(r);
      if (!r.success) setError(r.error || 'Auto-sync failed');
    } catch (e) {
      console.warn('[useNativeHealth] auto-sync check failed', e);
    } finally {
      autoSyncInFlight.current = false;
    }
  }, [healthAllowed, isSyncing]);

  useEffect(() => {
    if (!healthAllowed || !isNative()) return;
    // Initial check on mount / auth-ready
    runIfStale();
    // Recheck when app returns to foreground
    const onVisible = () => { if (document.visibilityState === 'visible') runIfStale(); };
    document.addEventListener('visibilitychange', onVisible);
    // Rolling 6h interval while app is alive
    autoSyncTimerRef.current = setInterval(runIfStale, STALE_THRESHOLD_MS);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      if (autoSyncTimerRef.current) clearInterval(autoSyncTimerRef.current);
    };
  }, [healthAllowed, runIfStale]);

  return { status, isAvailable: status?.available ?? false, isSyncing, lastSync, error,
    requestPermissions, quickSync, fetchRange, isNativePlatform: isNative() };
}