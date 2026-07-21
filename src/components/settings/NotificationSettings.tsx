import { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Smartphone, Moon, BellRing, Plus, Trash2, Check } from 'lucide-react';
import { useProfile } from '@/hooks/useProfile';
import { useToast } from '@/hooks/use-toast';
import { useFocusModes } from '@/hooks/useFocusModes';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { isPayReady } from '@/config/release';

const HOURS = Array.from({ length: 24 }, (_, i) => `${i.toString().padStart(2, '0')}:00`);

export function NotificationSettings() {
  const { preferences, updatePreferences } = useProfile();
  const { toast } = useToast();
  const payReady = isPayReady();

  

  const { modes, create: createFocus, activate: activateFocus, deactivateAll, remove: removeFocus } = useFocusModes();
  const { enable: enablePush, disable: disablePush } = usePushNotifications();

  const [newLabel, setNewLabel] = useState('');
  const [newStart, setNewStart] = useState('22:00');
  const [newEnd, setNewEnd] = useState('08:00');

  const handlePreferenceUpdate = async (key: string, value: boolean | string) => {
    try {
      await updatePreferences({ [key]: value });
    } catch (error) {
      toast({ title: 'Update Failed', description: `Could not save preference: ${key}`, variant: 'destructive' });
    }
  };

  const [pushPending, setPushPending] = useState(false);
  const handlePushToggle = async (v: boolean) => {
    if (pushPending) return;
    setPushPending(true);
    try {
      if (v) {
        const result = await enablePush();
        if (!result.ok) {
          toast({
            title: 'Push not enabled',
            description: result.reason || 'Permission denied',
            variant: 'destructive',
          });
          return;
        }
        await handlePreferenceUpdate('push_notifications', true);
        toast({ title: 'Push enabled', description: `Registered on ${result.platform}` });
      } else {
        await disablePush();
        await handlePreferenceUpdate('push_notifications', false);
      }
    } finally {
      setPushPending(false);
    }
  };

  const handleFocusToggle = async (v: boolean) => {
    await handlePreferenceUpdate('quiet_hours_enabled', v);
    if (!v) await deactivateAll();
  };

  const handleCreateFocus = async () => {
    if (!newLabel.trim()) {
      toast({ title: 'Label required', variant: 'destructive' });
      return;
    }
    await createFocus(newLabel.trim(), newStart, newEnd);
    setNewLabel('');
    toast({ title: 'Focus profile saved' });
  };

  return (
    <div className="space-y-6">

      {/* 1. In-App Notification Center */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <BellRing className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">In-App Center</h3>
        </div>

        <div className="flex items-center justify-between gap-3">
          <div className="space-y-0.5 min-w-0">
            <Label htmlFor="in-app-alerts" className="text-sm font-medium">Header Alerts</Label>
            <p className="text-xs text-muted-foreground">Show unread badges in the top menu</p>
          </div>
          <Switch
            id="in-app-alerts"
            checked={preferences?.in_app_alerts !== false}
            onCheckedChange={(v) => handlePreferenceUpdate('in_app_alerts', v)}
          />
        </div>

        <div className="flex items-center justify-between gap-3">
          <div className="space-y-0.5 min-w-0">
            <Label htmlFor="in-app-sounds" className="text-sm font-medium">UI Sound Effects</Label>
            <p className="text-xs text-muted-foreground">Chimes for transactions and alerts</p>
          </div>
          <Switch
            id="in-app-sounds"
            checked={preferences?.in_app_sounds !== false}
            onCheckedChange={(v) => handlePreferenceUpdate('in_app_sounds', v)}
          />
        </div>
      </section>

      {/* 2. Push Notifications */}
      <section className="space-y-4 pt-4 border-t">
        <div className="flex items-center gap-2">
          <Smartphone className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Push Notifications</h3>
        </div>

        <div className="flex items-center justify-between gap-3">
          <div className="space-y-0.5 min-w-0">
            <Label htmlFor="push-notifications" className="text-sm font-medium">Enable Push</Label>
            <p className="text-xs text-muted-foreground">Request device permission &amp; register token</p>
          </div>
          <Switch
            id="push-notifications"
            checked={preferences?.push_notifications || false}
            onCheckedChange={handlePushToggle}
            disabled={pushPending}
          />
        </div>

        {preferences?.push_notifications && (
          <div className="space-y-4 pl-3 border-l-2 border-primary/20 mt-4">
            <div className="flex items-center justify-between gap-3">
              <div className="space-y-0.5 min-w-0">
                <Label htmlFor="push-activity" className="text-sm font-medium">Activity &amp; Goals</Label>
                <p className="text-xs text-muted-foreground">Reminders and milestone celebrations</p>
              </div>
              <Switch
                id="push-activity"
                checked={preferences?.push_activity !== false}
                onCheckedChange={(v) => handlePreferenceUpdate('push_activity', v)}
              />
            </div>
            {payReady && (
              <div className="flex items-center justify-between gap-3">
                <div className="space-y-0.5 min-w-0">
                  <Label htmlFor="push-insights" className="text-sm font-medium">AI Insights</Label>
                  <p className="text-xs text-muted-foreground">Proactive health and financial alerts</p>
                </div>
                <Switch
                  id="push-insights"
                  checked={preferences?.push_insights || false}
                  onCheckedChange={(v) => handlePreferenceUpdate('push_insights', v)}
                />
              </div>
            )}
          </div>
        )}
      </section>

      {/* 3. Focus Mode with labeled profiles + history */}
      <section className="space-y-4 pt-4 border-t">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Moon className="w-4 h-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">Focus Mode</h3>
          </div>
          <Switch
            checked={preferences?.quiet_hours_enabled || false}
            onCheckedChange={handleFocusToggle}
          />
        </div>

        {preferences?.quiet_hours_enabled && (
          <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
            {/* Quick hours for the current/default profile */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Quiet Hours Start</Label>
                <Select
                  value={preferences?.quiet_hours_start || '22:00'}
                  onValueChange={(v) => handlePreferenceUpdate('quiet_hours_start', v)}
                >
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>{HOURS.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Quiet Hours End</Label>
                <Select
                  value={preferences?.quiet_hours_end || '08:00'}
                  onValueChange={(v) => handlePreferenceUpdate('quiet_hours_end', v)}
                >
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>{HOURS.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>

            {/* Saved profiles */}
            {modes.length > 0 && (
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Saved Profiles</Label>
                <ul className="space-y-1.5">
                  {modes.map((m) => (
                    <li key={m.id} className="flex items-center justify-between gap-2 p-2 rounded-md border border-border/50 bg-muted/20">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium truncate">{m.label}</span>
                          {m.is_active && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-primary">
                              <Check className="w-3 h-3" />active
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-muted-foreground">{m.quiet_hours_start} – {m.quiet_hours_end}</p>
                      </div>
                      {!m.is_active && (
                        <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => activateFocus(m.id)}>
                          Activate
                        </Button>
                      )}
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground" onClick={() => removeFocus(m.id)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Create new profile */}
            <div className="space-y-2 p-2 rounded-md border border-dashed border-border">
              <Label className="text-xs text-muted-foreground">New Profile</Label>
              <Input
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="e.g. Work hours, Sleep, Travel"
                className="h-9"
              />
              <div className="grid grid-cols-2 gap-2">
                <Select value={newStart} onValueChange={setNewStart}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>{HOURS.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={newEnd} onValueChange={setNewEnd}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>{HOURS.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <Button size="sm" className="w-full h-8" onClick={handleCreateFocus}>
                <Plus className="w-3.5 h-3.5 mr-1" /> Save Profile
              </Button>
            </div>
          </div>
        )}
      </section>

    </div>
  );
}
