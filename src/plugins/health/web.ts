import type { IDIAHealthPlugin, HealthAvailability, HealthPermissionStatus, HealthDataRequest, HealthDataResult } from './index';

export class IDIAHealthWeb implements IDIAHealthPlugin {
  async checkAvailability(): Promise<HealthAvailability> { return { available: false, platform: 'web', apiName: 'none' }; }
  async requestPermissions(): Promise<HealthPermissionStatus> { return { granted: true }; }
  async checkPermissions(): Promise<HealthPermissionStatus> { return { granted: true }; }
  async getHealthData(_options: HealthDataRequest): Promise<HealthDataResult> {
    return { recorded_at: new Date().toISOString(), source: 'web_manual', device_type: 'web_browser', type: 'health_metrics' };
  }
  async addListener(): Promise<any> { return { remove: async () => {} }; }
  async removeAllListeners(): Promise<void> {}
}