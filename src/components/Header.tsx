import { useNavigate } from "react-router-dom";
import { Settings, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useEnhancedProfile } from "@/hooks/useEnhancedProfile";
import NotificationBell from "@/components/NotificationBell";
import { FriendOrb } from "@/components/FriendAssistant";
import polishedLogo from "@/assets/IDIA_Life_Logo_Polished.png";

const Header = () => {
  const navigate = useNavigate();
  const { profile } = useEnhancedProfile();

  return (
    <header className="fixed top-0 left-0 right-0 bg-background border-b border-border px-2 py-2 pt-[max(0.5rem,env(safe-area-inset-top))] grid grid-cols-3 items-center z-40">
      <div className="flex items-center space-x-2 justify-self-start">
        <img src={polishedLogo} alt="IDIA Life" className="h-6 w-6" />
        <h1 className="text-lg font-bold text-foreground">IDIA Life</h1>
      </div>

      <div className="justify-self-center">
        <FriendOrb />
      </div>

      <div className="flex items-center gap-1 justify-self-end">
        <NotificationBell />

        {profile && (
          <Avatar className="w-8 h-8 border border-border cursor-pointer" onClick={() => navigate("/settings")}>
            <AvatarImage src={profile.avatar_url || ""} alt={profile.display_name || "Profile"} />
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
