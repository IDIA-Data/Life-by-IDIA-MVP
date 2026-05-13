import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Smartphone, Mail, Moon, BellRing, ShieldAlert } from 'lucide-react';
import { useProfile } from '@/hooks/useProfile';

export function NotificationSettings() {
  const { preferences, updatePreferences } = useProfile();

  // Helper to safely update boolean preferences
  const handleToggle = (key: string, value: boolean) => {
    updatePreferences({ [key]: value });
  };

  // Helper to safely update string preferences (like times)
  const handleSelect = (key: string, value: string) => {
    updatePreferences({ [key]: value });
  };

  return (
    <div className="space-y-6">
      
      {/* 1. In-App Notification Center (Header & Orb) */}
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
            checked={preferences?.in_app_alerts !== false} // Default to true
            onCheckedChange={(v) => handleToggle('in_app_alerts', v)}
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
            onCheckedChange={(v) => handleToggle('in_app_sounds', v)}
          />
        </div>
      </section>

      {/* 2. Push Notifications (Device Level) */}
      <section className="space-y-4 pt-4 border-t">
        <div className="flex items-center gap-2">
          <Smartphone className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Push Notifications</h3>
        </div>

        <div className="flex items-center justify-between gap-3">
          <div className="space-y-0.5 min-w-0">
            <Label htmlFor="push-notifications" className="text-sm font-medium">Enable Push</Label>
            <p className="text-xs text-muted-foreground">Master switch for device notifications</p>
          </div>
          <Switch
            id="push-notifications"
            checked={preferences?.push_notifications || false}
            onCheckedChange={(v) => handleToggle('push_notifications', v)}
          />
        </div>

        {preferences?.push_notifications && (
          <div className="space-y-4 pl-3 border-l-2 border-primary/20 mt-4">
            <div className="flex items-center justify-between gap-3">
              <div className="space-y-0.5 min-w-0">
                <Label htmlFor="push-activity" className="text-sm font-medium">Activity & Goals</Label>
                <p className="text-xs text-muted-foreground">Reminders and milestone celebrations</p>
              </div>
              <Switch 
                id="push-activity"
                checked={preferences?.push_activity !== false}
                onCheckedChange={(v) => handleToggle('push_activity', v)} 
              />
            </div>
            <div className="flex items-center justify-between gap-3">
              <div className="space-y-0.5 min-w-0">
                <Label htmlFor="push-insights" className="text-sm font-medium">AI Insights</Label>
                <p className="text-xs text-muted-foreground">Proactive health and financial alerts</p>
              </div>
              <Switch 
                id="push-insights"
                checked={preferences?.push_insights || false}
                onCheckedChange={(v) => handleToggle('push_insights', v)} 
              />
            </div>
          </div>
        )}
      </section>

      {/* 3. Focus / Quiet Hours */}
      <section className="space-y-4 pt-4 border-t">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Moon className="w-4 h-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">Focus Mode</h3>
          </div>
          <Switch 
            checked={preferences?.quiet_hours_enabled || false}
            onCheckedChange={(v) => handleToggle('quiet_hours_enabled', v)}
          />
        </div>

        {preferences?.quiet_hours_enabled && (
          <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Quiet Hours Start</Label>
              <Select 
                value={preferences?.quiet_hours_start || "22:00"}
                onValueChange={(v) => handleSelect('quiet_hours_start', v)}
              >
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 24 }, (_, i) => {
                    const hour = i.toString().padStart(2, '0');
                    return <SelectItem key={i} value={`${hour}:00`}>{hour}:00</SelectItem>;
                  })}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Quiet Hours End</Label>
              <Select 
                value={preferences?.quiet_hours_end || "08:00"}
                onValueChange={(v) => handleSelect('quiet_hours_end', v)}
              >
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 24 }, (_, i) => {
                    const hour = i.toString().padStart(2, '0');
                    return <SelectItem key={i} value={`${hour}:00`}>{hour}:00</SelectItem>;
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
      </section>

      {/* 4. Supabase Email Guardrails */}
      <section className="space-y-4 pt-4 border-t">
        <div className="flex items-center gap-2">
          <Mail className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Email Comms</h3>
        </div>

        {/* Security is hard-locked to true for compliance */}
        <div className="flex items-center justify-between gap-3 bg-muted/30 p-2.5 rounded-lg border border-border/50">
          <div className="flex items-center gap-3 min-w-0 opacity-80">
            <ShieldAlert className="w-4 h-4 text-destructive" />
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">Security Alerts</Label>
              <p className="text-[10px] text-muted-foreground">New logins and password changes</p>
            </div>
          </div>
          <Switch checked={true} disabled />
        </div>

        <div className="flex items-center justify-between gap-3 pl-1">
          <div className="space-y-0.5 min-w-0">
            <Label htmlFor="email-marketing" className="text-sm font-medium">Product Updates</Label>
            <p className="text-xs text-muted-foreground">Feature drops and announcements</p>
          </div>
          <Switch 
            id="email-marketing"
            checked={preferences?.marketing_emails || false}
            onCheckedChange={(v) => handleToggle('marketing_emails', v)}
          />
        </div>

        <div className="flex items-center justify-between gap-3 pl-1">
          <div className="space-y-0.5 min-w-0">
            <Label htmlFor="email-reports" className="text-sm font-medium">Monthly Reports</Label>
            <p className="text-xs text-muted-foreground">Data summaries and health metrics</p>
          </div>
          <Switch 
            id="email-reports"
            checked={preferences?.email_reports !== false} // Default to true
            onCheckedChange={(v) => handleToggle('email_reports', v)}
          />
        </div>
      </section>

    </div>
  );
}