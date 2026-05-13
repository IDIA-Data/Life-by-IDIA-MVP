import { useState } from "react";
import { useSubscription } from "@/hooks/useSubscription";
import ProPaywall from "./ProPaywall";
import HRIDashboard from "./HRIDashboard";
import CPMDashboard from "./CPMDashboard";
import PureAlphaDashboard from "./PureAlphaDashboard";
import SovereignAuth from "./SovereignAuth";

const ProScreen = () => {
  const { tier, loading, subscribe } = useSubscription();
  const [authVerified, setAuthVerified] = useState(false);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-[hsl(178,42%,32%)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Sovereign Auth gates the entire Pro tab — runs before paywall and any dashboard.
  if (!authVerified) {
    return <SovereignAuth onVerified={() => setAuthVerified(true)} />;
  }

  const isPaid = !!tier;
  const activeTier = tier || "pro";

  if (!tier) {
    return <ProPaywall currentTier={tier} onSubscribe={subscribe} />;
  }

  switch (activeTier) {
    case "pro":
      return <HRIDashboard isMasked={!isPaid} />;
    case "pro_plus":
      return <CPMDashboard isMasked={!isPaid} />;
    case "pure_alpha":
      return <PureAlphaDashboard isMasked={!isPaid} />;
    default:
      return <ProPaywall currentTier={tier} onSubscribe={subscribe} />;
  }
};

export default ProScreen;
