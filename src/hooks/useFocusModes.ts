import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface FocusMode {
  id: string;
  user_id: string;
  label: string;
  quiet_hours_start: string;
  quiet_hours_end: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export function useFocusModes() {
  const [modes, setModes] = useState<FocusMode[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    setUserId(user.id);
    const { data, error } = await (supabase.from("focus_modes" as any) as any)
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });
    if (!error) setModes((data || []) as FocusMode[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const create = async (label: string, start: string, end: string) => {
    if (!userId) return;
    const { error } = await (supabase.from("focus_modes" as any) as any).insert({
      user_id: userId, label, quiet_hours_start: start, quiet_hours_end: end, is_active: false,
    });
    if (!error) await load();
  };

  const activate = async (id: string) => {
    if (!userId) return;
    // Deactivate all, then activate this one (avoid partial-unique violation)
    await (supabase.from("focus_modes" as any) as any)
      .update({ is_active: false })
      .eq("user_id", userId);
    const target = modes.find(m => m.id === id);
    await (supabase.from("focus_modes" as any) as any)
      .update({ is_active: true })
      .eq("id", id);
    // Mirror to user_preferences so existing consumers keep working
    if (target) {
      await (supabase.from("user_preferences") as any)
        .update({
          quiet_hours_enabled: true,
          quiet_hours_start: target.quiet_hours_start,
          quiet_hours_end: target.quiet_hours_end,
        })
        .eq("user_id", userId);
    }
    await load();
  };

  const deactivateAll = async () => {
    if (!userId) return;
    await (supabase.from("focus_modes" as any) as any)
      .update({ is_active: false })
      .eq("user_id", userId);
    await load();
  };

  const remove = async (id: string) => {
    await (supabase.from("focus_modes" as any) as any).delete().eq("id", id);
    await load();
  };

  return { modes, loading, create, activate, deactivateAll, remove, reload: load };
}
