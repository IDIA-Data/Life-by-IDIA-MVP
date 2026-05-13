import { useState, useEffect, useRef } from "react";
import { Wallet, Database, Users, ShoppingBag, Vote, Crown } from "lucide-react";
import { useEnhancedProfile } from "@/hooks/useEnhancedProfile";
import EnhancedWalletDashboard from "./enhanced/EnhancedWalletDashboard";
import DataDashboard from "./DataDashboard";
import LifeScreen from "./enhanced/LifeScreen";
import ShopScreen from "./ShopScreen";
import GovernanceScreen from "./GovernanceScreen";
import ProScreen from "./pro/ProScreen";
import Header from "./Header";
import { FriendAssistantProvider } from "./FriendAssistant";
import WelcomeSequence from "./life/WelcomeSequence";

const MainApp = () => {
  const [activeTab, setActiveTab] = useState("life");
  const [showFriend, setShowFriend] = useState(false);
  const [friendTrigger, setFriendTrigger] = useState<"social" | "wallet" | "data" | "achievement" | undefined>();
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [showWelcome, setShowWelcome] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      return localStorage.getItem("idia_welcome_seen_v1") !== "1";
    } catch {
      return false;
    }
  });

  const { profile, loading: profileLoading } = useEnhancedProfile();
  const [isProvisioned, setIsProvisioned] = useState({ wallet: false, fbo: false });

  // Sovereign Audit — informational only (no gate)
  useEffect(() => {
    if (!profileLoading) {
      console.log("[START] MainApp: Executing infrastructure audit...");
      const hasWallet = !!profile?.wallet_address;
      const hasFBO = !!profile?.fbo_account_id;
      setIsProvisioned({ wallet: hasWallet, fbo: hasFBO });
      console.log(`[END] MainApp Audit Complete - Vault: ${hasWallet}, FBO: ${hasFBO}`);
    }
  }, [profile, profileLoading]);

  useEffect(() => {
    const handleVaultLinked = (event: any) => {
      console.log("[SYNC] Immediate Vault Hydration:", event.detail.address);
      setIsProvisioned((prev) => ({ ...prev, wallet: true }));
    };
    window.addEventListener("vault-linked", handleVaultLinked);
    return () => window.removeEventListener("vault-linked", handleVaultLinked);
  }, []);

  // AI Assistant Triggers (suppressed during first-run welcome)
  useEffect(() => {
    if (showWelcome) return;
    if (activeTab === "life") {
      setFriendTrigger("social");
      setShowFriend(true);
    } else if (friendTrigger === "social") {
      setShowFriend(false);
    }
  }, [activeTab, friendTrigger, showWelcome]);

  useEffect(() => {
    const handleShowFriend = (event: CustomEvent) => {
      const { trigger } = event.detail;
      setFriendTrigger(trigger);
      setShowFriend(true);
    };
    window.addEventListener("showFriend", handleShowFriend as EventListener);
    return () => window.removeEventListener("showFriend", handleShowFriend as EventListener);
  }, []);

  const tabs = [
    { id: "wallet", label: "Wallet", icon: Wallet, component: EnhancedWalletDashboard },
    { id: "data", label: "My Data", icon: Database, component: DataDashboard },
    { id: "life", label: "Life", icon: Users, component: LifeScreen },
    { id: "shop", label: "Shop", icon: ShoppingBag, component: ShopScreen },
    { id: "vote", label: "Vote", icon: Vote, component: GovernanceScreen },
    { id: "pro", label: "Pro", icon: Crown, component: ProScreen },
  ];

  const ActiveComponent = tabs.find((tab) => tab.id === activeTab)?.component || EnhancedWalletDashboard;

  return (
    <FriendAssistantProvider>
    <div className="flex flex-col h-screen overflow-hidden bg-background">
      <Header />

      <main className="flex-1 overflow-hidden pt-[calc(3.5rem+env(safe-area-inset-top))] relative">
        <div className="h-full max-w-4xl mx-auto">
          <div className="h-full px-2 pb-2 overflow-y-auto touch-pan-y no-scrollbar" style={{ WebkitOverflowScrolling: "touch" }}>
            <ActiveComponent />
          </div>
        </div>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-background border-t border-border pb-[env(safe-area-inset-bottom)] z-30 isolate pointer-events-auto shadow-[0_-10px_40px_rgba(0,0,0,0.1)]">
        <div className="max-w-4xl mx-auto px-2">
          <div className="flex justify-around py-2">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  ref={(el) => {
                    tabRefs.current[tab.id] = el;
                  }}
                  onClick={() => setActiveTab(tab.id)}
                  className={`relative flex flex-col items-center space-y-0.5 transition-colors p-2 ${
                    activeTab === tab.id ? "text-primary" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Icon className="w-5 h-5 pointer-events-none" />
                  <span className="text-xs pointer-events-none">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      {showWelcome && (
        <WelcomeSequence tabRefs={tabRefs} onComplete={() => setShowWelcome(false)} />
      )}
    </div>
    </FriendAssistantProvider>
  );
};

export default MainApp;
