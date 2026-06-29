import { useState, useEffect, useCallback } from 'react';
import { healthService } from '@/services/healthService';
import type { HealthSyncResult, HealthServiceStatus } from '@/services/healthService';
import { isNative } from '@/services/platform';
import { useProfile } from '@/hooks/useProfile';

export function useNativeHealth() {
  const [status, setStatus] = useState<HealthServiceStatus | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<HealthSyncResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { preferences } = useProfile();
  const healthAllowed = (preferences as any)?.privacy_health !== false;

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

  return { status, isAvailable: status?.available ?? false, isSyncing, lastSync, error,
    requestPermissions, quickSync, fetchRange, isNativePlatform: isNative() };
}