
import { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Shield, Database, Trash2, Download, Smartphone, Activity, Camera, HeartPulse, Bluetooth, Mic, ScanLine, Info, Loader2, ExternalLink, CheckCircle2, XCircle } from 'lucide-react';
import { useProfile } from '@/hooks/useProfile';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { SecureStoragePlugin } from 'capacitor-secure-storage-plugin';
import { useHardwarePermission } from '@/hooks/useHardwarePermission';
import type { HardwareKey } from '@/plugins/permissions';

const SECURE_KEYS_TO_WIPE = [
  'user_pii_profile',
  'recovery_phrase',
  'sovereign_seed',
  'vault_master_key',
  'wallet_private_key',
];

export function PrivacySettings() {
  const { preferences, updatePreferences } = useProfile();
  const { toast } = useToast();
  const [purging, setPurging] = useState(false);
  const [confirmText, setConfirmText] = useState('');

  const handlePreferenceUpdate = async (key: string, value: boolean) => {
    console.log(`[PrivacySettings] handlePreferenceUpdate START: Attempting to set '${key}' to ${value}`);
    try {
      await updatePreferences({ [key]: value });
      console.log(`[PrivacySettings] handlePreferenceUpdate SUCCESS: Successfully updated '${key}' in database`);
    } catch (error) {
      console.error(`[PrivacySettings] handlePreferenceUpdate ERROR: Failed to update database for '${key}'`, error);
      toast({ title: 'Update Failed', description: `Could not save preference: ${key}`, variant: 'destructive' });
    } finally {
      console.log(`[PrivacySettings] handlePreferenceUpdate END: Completed execution for '${key}'`);
    }
  };

  const exportData = async () => {
    console.log('[PrivacySettings] exportData START: Initiating data compilation process');
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) {
        console.log('[PrivacySettings] exportData ABORT: No authenticated user session found');
        return;
      }

      toast({ title: 'Compiling Data...', description: 'Generating your Sovereign CSV export.' });

      console.log('[PrivacySettings] exportData: Fetching relational profile data and consent records');
      // Fetch Profile & Consent Records (Bypassing strict types for un-migrated tables/columns)
      const [{ data: profile }, { data: consentRecords }] = await Promise.all([
        (supabase as any).from('profiles').select('*').eq('user_id', user.id).single(),
        (supabase as any).from('acas').select('*').eq('user_id', user.id)
      ]);

      console.log('[PrivacySettings] exportData: Formatting CSV structure');
      const csvRows = [];
      
      // Profile Data
      const fullName = profile?.display_name || [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || 'N/A';
      
      csvRows.push(['--- SOVEREIGN IDENTITY PROFILE ---']);
      csvRows.push(['ID', 'Created At']);
      csvRows.push([profile?.id || 'N/A', profile?.created_at || 'N/A']);
      csvRows.push([]); 
      
      // Consent Data
      csvRows.push(['--- CONSENT RECORDS ---']);
      csvRows.push(['Record ID', 'Timestamp', 'Consent Type', 'Status', 'Platform']);
      
      if (consentRecords && consentRecords.length > 0) {
        consentRecords.forEach((record: any) => {
          csvRows.push([record.id, record.created_at, record.consent_type, record.status, record.platform || 'IDIA Base']);
        });
      } else {
        csvRows.push(['No Consent Records found.']);
      }

      console.log('[PrivacySettings] exportData: Generating Blob and triggering download');
      // Compile CSV
      const csvContent = csvRows.map(row => row.join(",")).join("\n");
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", `IDIA_Sovereign_Export_${new Date().toISOString().split('T')[0]}.csv`);
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      console.log('[PrivacySettings] exportData SUCCESS: Payload delivered to user');
      toast({ title: 'Data Exported', description: 'Your CSV data has been downloaded successfully.' });
    } catch (error) {
      console.error('[PrivacySettings] exportData ERROR: Exception caught during compilation', error);
      toast({ title: 'Export Failed', description: 'Failed to export your data.', variant: 'destructive' });
    } finally {
      console.log('[PrivacySettings] exportData END');
    }
  };

  const wipeDevicePII = async () => {
    // Clear known Secure Enclave keys (best effort — missing keys throw)
    await Promise.all(
      SECURE_KEYS_TO_WIPE.map(async (key) => {
        try { await SecureStoragePlugin.remove({ key }); } catch { /* not present */ }
      })
    );
    try { await SecureStoragePlugin.clear(); } catch { /* web fallback or empty */ }
    try { localStorage.clear(); } catch { /* sandboxed */ }
    try { sessionStorage.clear(); } catch { /* sandboxed */ }
  };

  const deleteAccount = async () => {
    console.log("[PrivacySettings] deleteAccount START: Initiating permanent identity purge");
    setPurging(true);
    try {
      // 1. Server-side purge: every public-schema row + auth.users entry
      const { data, error } = await supabase.functions.invoke('purge-identity');
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error || 'Purge failed');

      console.log("[PrivacySettings] deleteAccount: Server purge complete", data);

      // 2. Wipe on-device PII (Secure Enclave + web storage)
      await wipeDevicePII();

      // 3. Sign out everywhere
      await supabase.auth.signOut({ scope: 'global' });

      toast({ title: 'Account Purged', description: 'Your Sovereign Identity has been permanently deleted.' });
      window.location.href = '/';
    } catch (error) {
      console.error('[PrivacySettings] deleteAccount ERROR: Failed to execute deletion protocol', error);
      toast({
        title: 'Deletion Failed',
        description: error instanceof Error ? error.message : 'Failed to delete your account',
        variant: 'destructive',
      });
      setPurging(false);
    } finally {
      console.log("[PrivacySettings] deleteAccount END");
    }
  };

  return (
    <div className="space-y-6">
      
      <div className="flex items-start gap-3 p-4 bg-primary/10 border border-primary/20 rounded-lg text-primary">
        <Info className="w-5 h-5 shrink-0 mt-0.5" />
        <p className="text-xs leading-relaxed font-medium">
          Our database is PII-Free, no personally identifiable information is in our database and your pattern of life is protected and never sold.
        </p>
      </div>

      {/* 1. Global Data Sharing */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Data Sovereignty</h3>
        </div>

        <div className="flex items-center justify-between gap-3">
          <div className="space-y-0.5 min-w-0">
            <Label htmlFor="data-sharing" className="text-sm font-medium">Data Sharing Consent</Label>
            <p className="text-xs text-muted-foreground">Allow anonymized telemetry for research insights</p>
          </div>
          <Switch
            id="data-sharing"
            checked={preferences?.data_sharing_consent || false}
            onCheckedChange={(v) => handlePreferenceUpdate('data_sharing_consent', v)}
          />
        </div>

        <div className="flex items-start gap-2 p-2.5 bg-muted/50 rounded-lg">
          <Shield className="w-3.5 h-3.5 text-[hsl(142,71%,45%)] mt-0.5 shrink-0" />
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            When disabled, all data remains strictly bound to your local device sandbox. No telemetry leaves the Sovereign framework.
          </p>
        </div>
      </section>

      {/* 2. Hardware Permissions (Edge Gating) */}
      <HardwarePermissionsSection />

      {/* 3. Data Management */}
      <section className="space-y-4 pt-4 border-t">
        <h3 className="text-sm font-semibold">Data Management</h3>

        <div className="flex items-center justify-between gap-3 bg-muted/20 p-3 rounded-lg border border-border/50">
          <div className="space-y-0.5 min-w-0">
            <div className="text-sm font-medium">Terms of Service</div>
            <p className="text-xs text-muted-foreground">View or download the IDIA Protocol Terms of Service you accepted</p>
          </div>
          <Button variant="outline" size="sm" asChild>
            <a href="/legal/IDIA_Protocol_Terms_of_Service.pdf" download>
              <Download className="w-3.5 h-3.5 mr-1.5" />
              Download PDF
            </a>
          </Button>
        </div>

        <div className="flex items-center justify-between gap-3 bg-muted/20 p-3 rounded-lg border border-border/50">
          <div className="space-y-0.5 min-w-0">
            <div className="text-sm font-medium">Export Identity Ledger</div>
            <p className="text-xs text-muted-foreground">Download a CSV of your data & Consent Records</p>
          </div>
          <Button variant="outline" size="sm" onClick={exportData}>
            <Download className="w-3.5 h-3.5 mr-1.5" />
            Export CSV
          </Button>
        </div>

        <div className="flex items-center justify-between gap-3 bg-destructive/5 p-3 rounded-lg border border-destructive/20">
          <div className="space-y-0.5 min-w-0">
            <div className="text-sm font-medium text-destructive">Purge Identity</div>
            <p className="text-[10px] text-muted-foreground">Permanently destroy account and keys</p>
          </div>
          <AlertDialog onOpenChange={(open) => { if (!open) setConfirmText(''); }}>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm" disabled={purging}>
                {purging ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5 mr-1.5" />}
                {purging ? 'Purging…' : 'Purge'}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. This will permanently delete your account,
                  purge all Consent Records, erase every database row tied to you, and destroy
                  your Sovereign Wallet keys on this device. Type <strong>PURGE</strong> below to confirm.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <Input
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="Type PURGE to confirm"
                autoComplete="off"
                disabled={purging}
              />
              <AlertDialogFooter>
                <AlertDialogCancel disabled={purging}>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={(e) => {
                    if (confirmText !== 'PURGE') { e.preventDefault(); return; }
                    deleteAccount();
                  }}
                  disabled={confirmText !== 'PURGE' || purging}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {purging ? 'Purging…' : 'Yes, Purge Identity'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </section>
    </div>
  );
}
// ─────────────────────────────────────────────────────────────────────────────
// Hardware Permissions Section — three-state UI bound to native OS prompts.
// ─────────────────────────────────────────────────────────────────────────────

const HW_ROWS: Array<{
  key: HardwareKey;
  label: string;
  description: string;
  Icon: React.ComponentType<{ className?: string }>;
}> = [
  { key: 'motion',     label: 'Device Motion', description: 'Gyroscope and spatial awareness',  Icon: Activity },
  { key: 'camera',     label: 'Camera',        description: 'Visual processing and AR features', Icon: Camera },
  { key: 'health',     label: 'Health Kit',    description: 'Biometrics and vitals syncing',     Icon: HeartPulse },
  { key: 'bluetooth',  label: 'Bluetooth',     description: 'Proximity and external wearables',  Icon: Bluetooth },
  { key: 'microphone', label: 'Microphone',    description: 'Voice interactions and commands',   Icon: Mic },
  { key: 'nfc',        label: 'NFC Scan',      description: 'Physical tap and handshake logic',  Icon: ScanLine },
];

function HardwarePermissionsSection() {
  const { isEnabled, grantState, setToggle, openAppSettings } = useHardwarePermission();
  const [pending, setPending] = useState<HardwareKey | null>(null);

  const onToggle = async (key: HardwareKey, next: boolean) => {
    setPending(key);
    try { await setToggle(key, next); } finally { setPending(null); }
  };

  return (
    <section className="space-y-4 pt-2 border-t">
      <div className="flex items-center gap-2">
        <Smartphone className="w-4 h-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">Hardware Permissions</h3>
      </div>

      <div className="space-y-4 pl-1">
        {HW_ROWS.map(({ key, label, description, Icon }) => {
          const enabled = isEnabled(key);
          const state = grantState[key];
          const denied = state === 'denied';
          const unsupported = state === 'unsupported';
          return (
            <div key={key} className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <Icon className="w-4 h-4 text-muted-foreground" />
                <div className="space-y-0.5">
                  <Label htmlFor={`privacy-${key}`} className="text-sm font-medium flex items-center gap-1.5">
                    {label}
                    {state === 'granted' && enabled && <CheckCircle2 className="w-3 h-3 text-[hsl(142,71%,45%)]" />}
                    {denied && <XCircle className="w-3 h-3 text-amber-500" />}
                  </Label>
                  <p className="text-xs text-muted-foreground">{description}</p>
                  {denied && (
                    <button
                      type="button"
                      onClick={openAppSettings}
                      className="text-[11px] text-amber-600 hover:underline inline-flex items-center gap-0.5 mt-0.5"
                    >
                      Open device Settings <ExternalLink className="w-2.5 h-2.5" />
                    </button>
                  )}
                  {unsupported && (
                    <p className="text-[11px] text-muted-foreground italic">Not available on this device</p>
                  )}
                </div>
              </div>
              <Switch
                id={`privacy-${key}`}
                checked={enabled}
                disabled={pending === key || unsupported}
                onCheckedChange={(v) => onToggle(key, v)}
              />
            </div>
          );
        })}
      </div>
    </section>
  );
}
