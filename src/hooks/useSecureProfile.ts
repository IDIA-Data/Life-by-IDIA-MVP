import { useState, useEffect, useCallback } from 'react';
import { SecureStoragePlugin } from 'capacitor-secure-storage-plugin';
import { supabase } from '@/integrations/supabase/client';

export interface SecurePII {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
}

/**
 * Pushes current PII to auth.users.user_metadata so the Hub
 * can read it via the life-pii-bridge edge function.
 * This is NOT a public-schema DB write — it updates the Auth service only.
 */
async function syncToAuth(data: SecurePII) {
  const displayName = `${data.first_name} ${data.last_name}`.trim();
  await supabase.auth.updateUser({
    data: {
      first_name: data.first_name,
      last_name: data.last_name,
      full_name: displayName,
      display_name: displayName,
      pii_synced_at: new Date().toISOString(),
    },
  });
}

/**
 * Hook to read/write PII from the device Secure Enclave.
 * This data is NEVER stored in or sent to the backend public schema.
 * After every save, PII is also pushed to user_metadata for the Hub bridge.
 */
export const useSecureProfile = () => {
  const [pii, setPii] = useState<SecurePII | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { value } = await SecureStoragePlugin.get({ key: 'user_pii_profile' });
      if (value) {
        const parsed = JSON.parse(value) as SecurePII;
        setPii(parsed);
      }
    } catch {
      // Key doesn't exist yet — first run
      setPii(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = useCallback(async (data: SecurePII) => {
    setSaving(true);
    try {
      await SecureStoragePlugin.set({
        key: 'user_pii_profile',
        value: JSON.stringify(data),
      });
      setPii(data);

      // Push to auth.users.user_metadata for Hub bridge
      await syncToAuth(data);
    } finally {
      setSaving(false);
    }
  }, []);

  return { pii, loading, saving, save, reload: load, syncToAuth };
};
