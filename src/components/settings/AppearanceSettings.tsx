import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Monitor, Moon, Sun, Eye, Palette } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { useProfile } from '@/hooks/useProfile';

export function AppearanceSettings() {
  const {
    theme,
    accessibilityMode,
    toggleTheme,
    toggleAccessibilityMode,
    updateHighContrast,
    updateFontSize
  } = useTheme();
  const { preferences } = useProfile();

  return (
    <div className="space-y-5">
      {/* Theme */}
      <section className="space-y-2">
        <div className="flex items-center gap-2">
          <Palette className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Theme</h3>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => theme !== 'light' && toggleTheme()}
            className={`flex items-center gap-2 p-2.5 rounded-lg border text-left transition-colors ${
              theme === 'light' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
            }`}
          >
            <Sun className="w-4 h-4" />
            <span className="text-sm font-medium">Light</span>
          </button>
          <button
            type="button"
            onClick={() => theme !== 'dark' && toggleTheme()}
            className={`flex items-center gap-2 p-2.5 rounded-lg border text-left transition-colors ${
              theme === 'dark' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
            }`}
          >
            <Moon className="w-4 h-4" />
            <span className="text-sm font-medium">Dark</span>
          </button>
        </div>
      </section>

      {/* Accessibility */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Eye className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Accessibility</h3>
        </div>

        <div className="flex items-center justify-between gap-3">
          <div className="space-y-0.5 min-w-0">
            <Label htmlFor="colorblind-mode" className="text-sm font-medium">Colorblind Mode</Label>
            <p className="text-xs text-muted-foreground">High contrast black and white</p>
          </div>
          <Switch
            id="colorblind-mode"
            checked={accessibilityMode === 'colorblind'}
            onCheckedChange={toggleAccessibilityMode}
          />
        </div>

        <div className="flex items-center justify-between gap-3">
          <div className="space-y-0.5 min-w-0">
            <Label htmlFor="high-contrast" className="text-sm font-medium">High Contrast</Label>
            <p className="text-xs text-muted-foreground">Increase contrast for readability</p>
          </div>
          <Switch
            id="high-contrast"
            checked={preferences?.high_contrast || false}
            onCheckedChange={updateHighContrast}
          />
        </div>

        <div className="flex items-center justify-between gap-3">
          <div className="space-y-0.5 min-w-0">
            <Label className="text-sm font-medium">Font Size</Label>
            <p className="text-xs text-muted-foreground">Adjust text size</p>
          </div>
          <Select
            value={preferences?.font_size || 'medium'}
            onValueChange={(v: 'small' | 'medium' | 'large') => updateFontSize(v)}
          >
            <SelectTrigger className="w-32 h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="small">Small</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="large">Large</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </section>

      {/* Preview */}
      <section className="space-y-2">
        <h3 className="text-sm font-semibold">Preview</h3>
        <div className="p-3 border rounded-lg space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
              <Monitor className="w-4 h-4 text-primary-foreground" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-medium">Sample Title</div>
              <div className="text-xs text-muted-foreground">Sample text to preview your settings</div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm">Primary</Button>
            <Button size="sm" variant="outline">Secondary</Button>
          </div>
          <div className="text-[10px] text-muted-foreground">
            {theme} · {accessibilityMode}
          </div>
        </div>
      </section>
    </div>
  );
}
