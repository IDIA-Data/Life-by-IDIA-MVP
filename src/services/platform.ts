import { Capacitor } from '@capacitor/core';
export type Platform = 'ios' | 'android' | 'web';
export function getPlatform(): Platform { const p = Capacitor.getPlatform(); return p === 'ios' ? 'ios' : p === 'android' ? 'android' : 'web'; }
export function isNative(): boolean { return Capacitor.isNativePlatform(); }
export function isIOS(): boolean { return Capacitor.getPlatform() === 'ios'; }
export function isAndroid(): boolean { return Capacitor.getPlatform() === 'android'; }
export function isWeb(): boolean { return !Capacitor.isNativePlatform(); }
