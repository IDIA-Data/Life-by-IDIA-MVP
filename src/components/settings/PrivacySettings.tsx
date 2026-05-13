import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Shield, Database, Trash2, Download, Smartphone, Activity, Camera, HeartPulse, Bluetooth, Mic, ScanLine } from 'lucide-react';
import { useProfile } from '@/hooks/useProfile';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

export function PrivacySettings() {
  const { preferences, updatePreferences } = useProfile();
  const { toast } = useToast();

  const exportData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      toast({ title: 'Compiling Data...', description: 'Generating your Sovereign CSV export.' });

      // Fetch Profile & ACAs (Bypassing strict types for un-migrated tables/columns)
      const [{ data: profile }, { data: acas }] = await Promise.all([
        (supabase as any).from('profiles').select('*').eq('user_id', user.id).single(),
        (supabase as any).from('acas').select('*').eq('user_id', user.id)
      ]);

      const csvRows = [];
      
      // Profile Data
      const fullName = profile?.display_name || [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || 'N/A';
      
      csvRows.push(['--- SOVEREIGN IDENTITY PROFILE ---']);
      csvRows.push(['ID', 'Name', 'Email', 'Created At']);
      csvRows.push([profile?.id || 'N/A', fullName, user.email || 'N/A', profile?.created_at || 'N/A']);
      csvRows.push([]); 
      
      // ACA Data
      csvRows.push(['--- AUDITABLE CONSENT ARTIFACTS (ACAs) ---']);
      csvRows.push(['ACA ID', 'Timestamp', 'Consent Type', 'Status', 'Platform']);
      
      if (acas && acas.length > 0) {
        acas.forEach((aca: any) => {
          csvRows.push([aca.id, aca.created_at, aca.consent_type, aca.status, aca.platform || 'IDIA Base']);
        });
      } else {
        csvRows.push(['No Auditable Consent Artifacts found.']);
      }

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

      toast({ title: 'Data Exported', description: 'Your CSV data has been downloaded successfully.' });
    } catch (error) {
      console.error('Error exporting data:', error);
      toast({ title: 'Export Failed', description: 'Failed to export your data.', variant: 'destructive' });
    }
  };

  const deleteAccount = async () => {
    try {
      console.log("=== [ACCOUNT_PURGE] Initiating permanent deletion ===");
      
      // Sign out to purge local session (RPC delete trigger handles DB teardown)
      const { error } = await supabase.auth.signOut();
      if (error) throw error;

      toast({ title: 'Account Purged', description: 'Your Sovereign Identity has been permanently deleted.' });
      window.location.href = '/';
    } catch (error) {
      console.error('Error deleting account:', error);
      toast({ title: 'Deletion Failed', description: 'Failed to delete your account', variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-6">
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
            onCheckedChange={(v) => updatePreferences({ data_sharing_consent: v })}
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
      <section className="space-y-4 pt-2 border-t">
        <div className="flex items-center gap-2">
          <Smartphone className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Hardware Permissions</h3>
        </div>

        <div className="space-y-4 pl-1">
          {/* Motion */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <Activity className="w-4 h-4 text-muted-foreground" />
              <div className="space-y-0.5">
                <Label htmlFor="privacy-motion" className="text-sm font-medium">Device Motion</Label>
                <p className="text-xs text-muted-foreground">Gyroscope and spatial awareness</p>
              </div>
            </div>
            <Switch
              id="privacy-motion"
              checked={preferences?.privacy_motion !== false} // Defaulting to true if undefined
              onCheckedChange={(v) => updatePreferences({ privacy_motion: v })}
            />
          </div>

          {/* Camera */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <Camera className="w-4 h-4 text-muted-foreground" />
              <div className="space-y-0.5">
                <Label htmlFor="privacy-camera" className="text-sm font-medium">Camera</Label>
                <p className="text-xs text-muted-foreground">Visual processing and AR features</p>
              </div>
            </div>
            <Switch
              id="privacy-camera"
              checked={preferences?.privacy_camera !== false}
              onCheckedChange={(v) => updatePreferences({ privacy_camera: v })}
            />
          </div>

          {/* Health */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <HeartPulse className="w-4 h-4 text-muted-foreground" />
              <div className="space-y-0.5">
                <Label htmlFor="privacy-health" className="text-sm font-medium">Health Kit</Label>
                <p className="text-xs text-muted-foreground">Biometrics and vitals syncing</p>
              </div>
            </div>
            <Switch
              id="privacy-health"
              checked={preferences?.privacy_health !== false}
              onCheckedChange={(v) => updatePreferences({ privacy_health: v })}
            />
          </div>

          {/* Bluetooth */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <Bluetooth className="w-4 h-4 text-muted-foreground" />
              <div className="space-y-0.5">
                <Label htmlFor="privacy-bluetooth" className="text-sm font-medium">Bluetooth</Label>
                <p className="text-xs text-muted-foreground">Proximity and external wearables</p>
              </div>
            </div>
            <Switch
              id="privacy-bluetooth"
              checked={preferences?.privacy_bluetooth !== false}
              onCheckedChange={(v) => updatePreferences({ privacy_bluetooth: v })}
            />
          </div>

          {/* Microphone */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <Mic className="w-4 h-4 text-muted-foreground" />
              <div className="space-y-0.5">
                <Label htmlFor="privacy-mic" className="text-sm font-medium">Microphone</Label>
                <p className="text-xs text-muted-foreground">Voice interactions and commands</p>
              </div>
            </div>
            <Switch
              id="privacy-mic"
              checked={preferences?.privacy_microphone !== false}
              onCheckedChange={(v) => updatePreferences({ privacy_microphone: v })}
            />
          </div>

          {/* NFC Scan */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <ScanLine className="w-4 h-4 text-muted-foreground" />
              <div className="space-y-0.5">
                <Label htmlFor="privacy-nfc" className="text-sm font-medium">NFC Scan</Label>
                <p className="text-xs text-muted-foreground">Physical tap and handshake logic</p>
              </div>
            </div>
            <Switch
              id="privacy-nfc"
              checked={preferences?.privacy_nfc !== false}
              onCheckedChange={(v) => updatePreferences({ privacy_nfc: v })}
            />
          </div>
        </div>
      </section>

      {/* 3. Data Management */}
      <section className="space-y-4 pt-4 border-t">
        <h3 className="text-sm font-semibold">Data Management</h3>

        <div className="flex items-center justify-between gap-3 bg-muted/20 p-3 rounded-lg border border-border/50">
          <div className="space-y-0.5 min-w-0">
            <div className="text-sm font-medium">Export Identity Ledger</div>
            <p className="text-xs text-muted-foreground">Download a CSV of your data & ACAs</p>
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
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm">
                <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                Purge
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. This will permanently delete your account,
                  purge all Auditable Consent Artifacts (ACAs), and destroy your Sovereign Wallet keys.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={deleteAccount}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Yes, Purge Identity
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </section>
    </div>
  );
}