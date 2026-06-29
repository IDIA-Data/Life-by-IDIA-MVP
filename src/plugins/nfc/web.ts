import { WebPlugin } from '@capacitor/core';
import type { IDIANFCPluginInterface } from './index';

export class IDIANFCPluginWeb extends WebPlugin implements IDIANFCPluginInterface {
  async beginHandshake(): Promise<{ payload: string }> {
    throw new Error('NFC is not available on this platform.');
  }
}