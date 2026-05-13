import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export type SubscriptionTier = "pro" | "pro_plus" | "pure_alpha" | null;

// Ranking for upgrade/downgrade logic
export const TIER_RANK: Record<string, number> = {
  null: 0,
  pro: 1,
  pro_plus: 2,
  pure_alpha: 3,
};

export const useSubscription = () => {
  // Defaulting to 'pro' for development to ensure no gating
  const [tier, setTier] = useState<SubscriptionTier>(() => {
    return (localStorage.getItem("idia_dev_tier") as SubscriptionTier) || "pro";
  });
  const [loading, setLoading] = useState(true);

  const fetchSubscription = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data } = await (supabase
          .from("user_subscriptions" as any)
          .select("tier")
          .eq("user_id", user.id)
          .eq("status", "active")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle() as any);

        if (data?.tier) {
          setTier(data.tier);
          localStorage.setItem("idia_dev_tier", data.tier);
        }
      }
    } catch (e) {
      console.error("Subscription fetch error:", e);
    } finally {
      setLoading(false);
    }
  };

  const subscribe = async (selectedTier: SubscriptionTier) => {
    if (!selectedTier) return false;
    setTier(selectedTier);
    localStorage.setItem("idia_dev_tier", selectedTier);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("user_subscriptions" as any).insert({
        user_id: user.id,
        tier: selectedTier,
        status: "active",
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      } as any);
    }
    return true;
  };

  useEffect(() => {
    fetchSubscription();
  }, []);

  return { tier, loading, subscribe, refetch: fetchSubscription };
};
