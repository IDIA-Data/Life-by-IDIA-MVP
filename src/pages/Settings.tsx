import { useState, useEffect } from "react";
import { ArrowLeft, User, Palette, Shield, Bell, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AppearanceSettings } from "@/components/settings/AppearanceSettings";
import { PrivacySettings } from "@/components/settings/PrivacySettings";
import { NotificationSettings } from "@/components/settings/NotificationSettings";
import EnhancedProfileSettings from "@/components/enhanced/EnhancedProfileSettings";
import { useToast } from "@/hooks/use-toast";
import { useEnhancedProfile } from "@/hooks/useEnhancedProfile";

export default function Settings() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [user, setUser] = useState<any>(null);
  const { toast } = useToast();
  const { profile } = useEnhancedProfile();

  // Realtime avatar states
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [cacheBuster, setCacheBuster] = useState(Date.now());

  const [activeTab, setActiveTab] = useState("idia-profile");

  // Get tab from URL parameter
  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab && ["idia-profile", "appearance", "privacy", "notifications"].includes(tab)) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  // Get current user and handle authentication
  useEffect(() => {
    const getUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUser(user);

      if (!user) {
        navigate("/auth");
        return;
      }
    };
    getUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user || null);
      if (!session?.user) {
        navigate("/auth");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  // Sync initial avatar load
  useEffect(() => {
    if (profile?.avatar_url) {
      setAvatarUrl(profile.avatar_url);
    }
  }, [profile?.avatar_url]);

  // Realtime Database Sync for Avatar Uploads
  useEffect(() => {
    if (!profile?.user_id) return;

    const channel = supabase
      .channel("settings-avatar-sync")
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
            setCacheBuster(Date.now()); // Forces browser cache bust
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel).catch((err) => console.error(err));
    };
  }, [profile?.user_id]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast({
      title: "Signed out",
      description: "You have been successfully signed out.",
    });
    navigate("/auth");
  };

  const finalAvatarSrc = avatarUrl ? `${avatarUrl}?t=${cacheBuster}` : "";

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background pt-[max(0.5rem,env(safe-area-inset-top))] pb-[env(safe-area-inset-bottom)]">
      <div className="container max-w-4xl mx-auto py-2 px-2 sm:px-3 flex flex-col flex-1 min-h-0">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 mb-2 shrink-0">
          <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="flex items-center gap-2 shrink-0">
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>

          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-semibold text-foreground">Settings</h1>
          </div>

          {user && (
            <div className="flex items-center gap-3 shrink-0 w-full sm:w-auto">
              <Avatar className="w-10 h-10 border border-border">
                <AvatarImage src={finalAvatarSrc} alt={profile?.display_name || "Profile"} />
                <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
                  {profile?.first_name ? profile.first_name[0] : <User className="w-4 h-4" />}
                  {profile?.last_name ? profile.last_name[0] : ""}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1 sm:flex-none">
                <p className="text-sm font-medium truncate">
                  {profile?.display_name || user.user_metadata?.full_name || "User"}
                </p>
                <p className="text-xs text-muted-foreground truncate">{user.email}</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleSignOut}
                className="text-muted-foreground hover:text-destructive"
                title="Sign out"
              >
                <LogOut className="w-5 h-5" />
                <span className="sr-only">Sign out</span>
              </Button>
            </div>
          )}
        </div>

        {/* Settings Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col flex-1 min-h-0">
          <TabsList className="grid grid-cols-4 w-full bg-muted/20 shrink-0">
            <TabsTrigger value="idia-profile" className="text-[11px] px-1">
              IDIA
            </TabsTrigger>
            <TabsTrigger value="appearance" className="text-[11px] px-1">
              Appearance
            </TabsTrigger>
            <TabsTrigger value="privacy" className="text-[11px] px-1">
              Privacy
            </TabsTrigger>
            <TabsTrigger value="notifications" className="text-[11px] px-1">
              Notifications
            </TabsTrigger>
          </TabsList>

          <TabsContent value="idia-profile" className="flex-1 min-h-0 overflow-hidden mt-2">
            <div
              className="h-full overflow-y-auto touch-pan-y no-scrollbar pr-1"
              style={{ WebkitOverflowScrolling: "touch" }}
            >
              <EnhancedProfileSettings />
            </div>
          </TabsContent>

          <TabsContent value="appearance" className="flex-1 min-h-0 overflow-hidden mt-2">
            <div
              className="h-full overflow-y-auto touch-pan-y no-scrollbar pr-1"
              style={{ WebkitOverflowScrolling: "touch" }}
            >
              <AppearanceSettings />
            </div>
          </TabsContent>

          <TabsContent value="privacy" className="flex-1 min-h-0 overflow-hidden mt-2">
            <div
              className="h-full overflow-y-auto touch-pan-y no-scrollbar pr-1"
              style={{ WebkitOverflowScrolling: "touch" }}
            >
              <Card>
                <CardHeader className="py-2 px-3">
                  <CardTitle className="text-sm font-semibold">Privacy & Data</CardTitle>
                  <CardDescription className="text-xs">
                    Control your data sharing and privacy preferences
                  </CardDescription>
                </CardHeader>
                <CardContent className="px-3 pb-3 pt-0">
                  <PrivacySettings />
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="notifications" className="flex-1 min-h-0 overflow-hidden mt-2">
            <div
              className="h-full overflow-y-auto touch-pan-y no-scrollbar pr-1"
              style={{ WebkitOverflowScrolling: "touch" }}
            >
              <Card>
                <CardHeader className="py-2 px-3">
                  <CardTitle className="text-sm font-semibold">Notification Settings</CardTitle>
                  <CardDescription className="text-xs">Manage your notification preferences</CardDescription>
                </CardHeader>
                <CardContent className="px-3 pb-3 pt-0">
                  <NotificationSettings />
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
