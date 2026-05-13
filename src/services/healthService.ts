import { IDIAHealth } from '@/plugins/health';
import type { HealthDataResult } from '@/plugins/health';
import { supabase } from '@/integrations/supabase/client';
import { isNative, getPlatform } from './platform';

export interface HealthSyncResult { success: boolean; data?: HealthDataResult; error?: string; synced: boolean; }
export interface HealthServiceStatus { available: boolean; permissionsGranted: boolean; platform: string; apiName: string; }

class HealthService {
  async getStatus(): Promise<HealthServiceStatus> {
    try {
      const a = await IDIAHealth.checkAvailability();
      let g = false;
      if (a.available) { g = (await IDIAHealth.checkPermissions()).granted; }
      return { available: a.available, permissionsGranted: g, platform: a.platform, apiName: a.apiName };
    } catch { return { available: false, permissionsGranted: false, platform: getPlatform(), apiName: 'error' }; }
  }

  async requestPermissions(): Promise<boolean> {
    try { return (await IDIAHealth.requestPermissions()).granted; } catch { return false; }
  }

  async fetchAndSync(startDate?: Date | string, endDate?: Date | string, autoSync = true): Promise<HealthSyncResult> {
    const start = startDate instanceof Date ? startDate.toISOString() : startDate || new Date(Date.now() - 86400000).toISOString();
    const end = endDate instanceof Date ? endDate.toISOString() : endDate || new Date().toISOString();
    try {
      const d = await IDIAHealth.getHealthData({ startDate: start, endDate: end });
      if (d.source === 'web_manual') return { success: true, data: d, synced: false };
      if (autoSync) { const s = await this.syncToSupabase(d); return { success: true, data: d, synced: s }; }
      return { success: true, data: d, synced: false };
    } catch (e: any) { return { success: false, error: e.message, synced: false }; }
  }

  async quickSync(): Promise<HealthSyncResult> {
    const s = new Date(); s.setHours(0,0,0,0);
    return this.fetchAndSync(s, new Date(), true);
  }

  async getRecentRecords(limit = 10): Promise<any[]> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data, error } = await supabase.from('raw_health_data').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(limit);
      return error ? [] : data || [];
    } catch { return []; }
  }

  private async syncToSupabase(healthData: HealthDataResult): Promise<boolean> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;
      const { error } = await supabase.functions.invoke('health-data-bridge', {
        body: {
          user_id: user.id,
          health_data: {
            source: healthData.source, device_type: healthData.device_type, type: healthData.type,
            recorded_at: healthData.recorded_at, steps: healthData.steps || 0, step_count: healthData.steps || 0,
            heartRate: healthData.heartRate, calories: healthData.calories, sleepHours: healthData.sleepHours,
            distance: healthData.distance, weight: healthData.weight, height: healthData.height,
            oxygenSaturation: healthData.oxygenSaturation, respiratoryRate: healthData.respiratoryRate,
            bodyTemperature: healthData.bodyTemperature, bloodGlucose: healthData.bloodGlucose,
          },
        },
      });
      if (error) { console.error('health-data-bridge error:', error); return false; }
      return true;
    } catch (e) { console.error('Sync failed:', e); return false; }
  }
}

export const healthService = new HealthService();
