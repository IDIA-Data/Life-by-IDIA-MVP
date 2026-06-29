import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Settings, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useEnhancedProfile } from "@/hooks/useEnhancedProfile";
import NotificationBell from "@/components/NotificationBell";
import { FriendOrb } from "@/components/FriendAssistant";
import polishedLogo from "@/assets/IDIA_Life_Logo_Polished.png";
import { supabase } from "@/integrations/supabase/client";

const Header = () => {
  const navigate = useNavigate();
  const { profile } = useEnhancedProfile();

  // Local state to manage the avatar independently in the Header
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [cacheBuster, setCacheBuster] = useState(Date.now());

  // 1. Sync with the hook's initial load
  useEffect(() => {
    if (profile?.avatar_url) {
      setAvatarUrl(profile.avatar_url);
    }
  }, [profile?.avatar_url]);

  // 2. Listen directly to the database to catch uploads from the Settings page instantly
  useEffect(() => {
    if (!profile?.user_id) return;

    const channel = supabase
      .channel("header-avatar-sync")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "profiles",
          filter: `user_id=eq.${profile.user_id}`,
        },
        (payload) => {
          if (payload.new && payload.new.avatar_url) {
            setAvatarUrl(payload.new.avatar_url);
            setCacheBuster(Date.now()); // Forces browser to pull the fresh image
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel).catch((err) => console.error(err));
    };
  }, [profile?.user_id]);

  // Construct the final URL with the cache buster
  const finalAvatarSrc = avatarUrl ? `${avatarUrl}?t=${cacheBuster}` : "";

  return (
    <header className="fixed top-0 left-0 right-0 bg-background border-b border-border px-2 py-2 pt-[max(0.5rem,env(safe-area-inset-top))] grid grid-cols-3 items-center z-40">
      <div className="flex items-center space-x-2 justify-self-start">
        <img src={polishedLogo} alt="IDIA Life" className="h-6 w-6" />
        <h1 className="text-lg font-bold text-foreground">IDIA Life</h1>
      </div>

      <div className="justify-self-center" />

      <div className="flex items-center gap-1 justify-self-end">
        <NotificationBell />

        {profile && (
          <Avatar className="w-8 h-8 border border-border cursor-pointer" onClick={() => navigate("/settings")}>
            <AvatarImage src={finalAvatarSrc} alt={profile.display_name || "Profile"} />
            <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
              {profile.first_name ? profile.first_name[0] : <User className="w-4 h-4" />}
              {profile.last_name ? profile.last_name[0] : ""}
            </AvatarFallback>
          </Avatar>
        )}

        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-foreground"
          onClick={() => navigate("/settings")}
        >
          <Settings className="w-5 h-5" />
          <span className="sr-only">Settings</span>
        </Button>
      </div>
    </header>
  );
};

export default Header;
