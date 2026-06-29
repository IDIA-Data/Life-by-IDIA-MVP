
import { useState, useEffect, useRef, useMemo } from "react";
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
import NoWalletNudge from "./wallet/NoWalletNudge";
import SelfDelegateEducationModal from "./wallet/SelfDelegateEducationModal";
import { IDIA_PAY_RELEASE_DATE } from "@/config/release";

const MainApp = () => {
  const [activeTab, setActiveTab] = useState("wallet");
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
  const [showSelfDelegateEdu, setShowSelfDelegateEdu] = useState(false);
  const [selfDelegateEduAddress, setSelfDelegateEduAddress] = useState<string | null>(null);

  // 1. Calculate release status
  const isPayReady = useMemo(() => new Date() >= IDIA_PAY_RELEASE_DATE, []);

  // 2. Define dynamic tabs based on release truth
  const tabs = useMemo(
    () => [
      { id: "wallet", label: "Wallet", icon: Wallet, component: EnhancedWalletDashboard },
      { id: "data", label: "Data", icon: Database, component: DataDashboard },
      ...(isPayReady ? [{ id: "life", label: "Life", icon: Users, component: LifeScreen }] : []),
      ...(isPayReady ? [{ id: "shop", label: "Shop", icon: ShoppingBag, component: ShopScreen }] : []),
      { id: "vote", label: "Gov", icon: Vote, component: GovernanceScreen },
      ...(isPayReady ? [{ id: "pro", label: "Pro", icon: Crown, component: ProScreen }] : []),
    ],
    [isPayReady],
  );

  // Sovereign Audit — informational only
  useEffect(() => {
    if (!profileLoading) {
      console.log("[START] MainApp: Executing infrastructure audit...");
      const hasWallet = !!profile?.wallet_address;
      const hasFBO = !!profile?.fbo_account_id;
      setIsProvisioned({ wallet: hasWallet, fbo: hasFBO });
      console.log(`[END] MainApp Audit Complete - Pay Ready: ${isPayReady}, Vault: ${hasWallet}, FBO: ${hasFBO}`);
    }
  }, [profile, profileLoading, isPayReady]);

  useEffect(() => {
    const handleVaultLinked = (event: any) => {
      const address: string | undefined = event?.detail?.address;
      console.log("[SYNC] Immediate Vault Hydration:", address);
      setIsProvisioned((prev) => ({ ...prev, wallet: true }));
      setNudgeDismissed(true);
      if (address) {
        try {
          const key = `idia_self_delegate_edu_seen_v1:${address.toLowerCase()}`;
          if (localStorage.getItem(key) !== "1") {
            setSelfDelegateEduAddress(address);
            setShowSelfDelegateEdu(true);
          }
        } catch {}
      }
    };
    window.addEventListener("vault-linked", handleVaultLinked);
    return () => window.removeEventListener("vault-linked", handleVaultLinked);
  }, []);

  // Dismissible "no wallet" nudge — appears after welcome, when no vault is linked.
  const [nudgeDismissed, setNudgeDismissed] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    try {
      const uid = profile?.user_id || profile?.id || "anon";
      return localStorage.getItem(`idia_wallet_nudge_dismissed_v1:${uid}`) === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (!profile) return;
    try {
      const uid = profile.user_id || profile.id || "anon";
      setNudgeDismissed(localStorage.getItem(`idia_wallet_nudge_dismissed_v1:${uid}`) === "1");
    } catch {}
  }, [profile?.user_id, profile?.id]);

  const dismissNudge = () => {
    setNudgeDismissed(true);
    try {
      const uid = profile?.user_id || profile?.id || "anon";
      localStorage.setItem(`idia_wallet_nudge_dismissed_v1:${uid}`, "1");
    } catch {}
  };

  const handleCreateWalletFromNudge = () => {
    dismissNudge();
    setActiveTab("wallet");
    window.dispatchEvent(new CustomEvent("wallet:open-security", { detail: { mode: "create" } }));
  };

  const showNudge =
    !showWelcome &&
    !profileLoading &&
    !!profile &&
    !isProvisioned.wallet &&
    !nudgeDismissed;

  // AI Assistant Triggers
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

  const ActiveComponent = tabs.find((tab) => tab.id === activeTab)?.component || EnhancedWalletDashboard;

  return (
    <FriendAssistantProvider>
      <div className="flex flex-col h-screen overflow-hidden bg-background">
        <Header />

        <main className="flex-1 overflow-hidden pt-[calc(3.5rem+env(safe-area-inset-top))] relative">
          <div className="h-full max-w-4xl mx-auto">
            <div
              className="h-full px-2 pb-2 overflow-y-auto touch-pan-y no-scrollbar"
              style={{ WebkitOverflowScrolling: "touch" }}
            >
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

        {showWelcome && <WelcomeSequence tabRefs={tabRefs} onComplete={() => setShowWelcome(false)} />}
        <NoWalletNudge
          isVisible={showNudge}
          onDismiss={dismissNudge}
          onCreateWallet={handleCreateWalletFromNudge}
        />
        <SelfDelegateEducationModal
          isVisible={showSelfDelegateEdu}
          onDismiss={() => {
            setShowSelfDelegateEdu(false);
            if (selfDelegateEduAddress) {
              try {
                localStorage.setItem(
                  `idia_self_delegate_edu_seen_v1:${selfDelegateEduAddress.toLowerCase()}`,
                  "1",
                );
              } catch {}
            }
          }}
          onGoToWallet={() => setActiveTab("wallet")}
        />
      </div>
    </FriendAssistantProvider>
  );
};

export default MainApp;