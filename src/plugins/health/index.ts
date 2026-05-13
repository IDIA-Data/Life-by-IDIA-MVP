import { registerPlugin } from '@capacitor/core';
import type { Plugin } from '@capacitor/core';

export interface HealthDataRequest { startDate: string; endDate: string; }
export interface HealthDataResult {
  recorded_at: string; source: 'apple_health' | 'health_connect' | 'web_manual';
  device_type: string; type: 'health_metrics';
  steps?: number; heartRate?: number; calories?: number; sleepHours?: number;
  distance?: number; weight?: number; height?: number;
  oxygenSaturation?: number; bloodPressureSystolic?: number; bloodPressureDiastolic?: number;
  bodyTemperature?: number; respiratoryRate?: number; bloodGlucose?: number; hydration?: number;
}
export interface HealthAvailability { available: boolean; platform: 'android' | 'ios' | 'web'; apiName: string; }
export interface HealthPermissionStatus { granted: boolean; }

export interface IDIAHealthPlugin extends Plugin {
  checkAvailability(): Promise<HealthAvailability>;
  requestPermissions(): Promise<HealthPermissionStatus>;
  checkPermissions(): Promise<HealthPermissionStatus>;
  getHealthData(options: HealthDataRequest): Promise<HealthDataResult>;
}

const IDIAHealth = registerPlugin<IDIAHealthPlugin>('IDIAHealth', {
  web: () => import('./web').then(m => new m.IDIAHealthWeb()),
});

export { IDIAHealth };