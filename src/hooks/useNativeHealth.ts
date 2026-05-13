import { useState, useEffect, useCallback } from 'react';
import { healthService } from '@/services/healthService';
import type { HealthSyncResult, HealthServiceStatus } from '@/services/healthService';
import { isNative } from '@/services/platform';

export function useNativeHealth() {
  const [status, setStatus] = useState<HealthServiceStatus | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<HealthSyncResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { healthService.getStatus().then(setStatus).catch(console.error); }, []);

  const requestPermissions = useCallback(async () => {
    setError(null);
    const granted = await healthService.requestPermissions();
    setStatus(await healthService.getStatus());
    return granted;
  }, []);

  const quickSync = useCallback(async () => {
    setIsSyncing(true); setError(null);
    try {
      const r = await healthService.quickSync(); setLastSync(r);
      if (!r.success) setError(r.error || 'Sync failed');
      return r;
    } catch (e: any) {
      const r: HealthSyncResult = { success: false, error: e.message, synced: false };
      setLastSync(r); setError(e.message); return r;
    } finally { setIsSyncing(false); }
  }, []);

  const fetchRange = useCallback(async (start: Date, end: Date) => {
    setIsSyncing(true); setError(null);
    try {
      const r = await healthService.fetchAndSync(start, end, true); setLastSync(r);
      if (!r.success) setError(r.error || 'Fetch failed');
      return r;
    } catch (e: any) {
      const r: HealthSyncResult = { success: false, error: e.message, synced: false };
      setLastSync(r); setError(e.message); return r;
    } finally { setIsSyncing(false); }
  }, []);

  return { status, isAvailable: status?.available ?? false, isSyncing, lastSync, error,
    requestPermissions, quickSync, fetchRange, isNativePlatform: isNative() };
}