import { registerPlugin } from '@capacitor/core';

export interface IDIANFCPluginInterface {
  beginHandshake(options: {
    config: { aca_hash: string; base_signature: string };
  }): Promise<{ payload: string }>;
}

const IDIANFC = registerPlugin<IDIANFCPluginInterface>('IDIANFC', {
  web: () => import('./web').then(m => new m.IDIANFCPluginWeb()),
});

export default IDIANFC;