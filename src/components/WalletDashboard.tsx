import { useState, useEffect } from "react";
import { ArrowUpRight, ArrowDownLeft, CreditCard, TrendingUp, Coins, Sparkles, Zap } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import AddFundsModal from "./AddFundsModal";
import { eventTracker } from "@/utils/EventTracker";
import { useWalletBalance } from "@/hooks/useWalletBalance";

type ActivityUnit = "usd" | "cr" | "usdc";

interface ActivityItem {
  id: string;
  kind: "earn" | "payment_sent" | "payment_received" | "governance" | "royalty" | "credit_purchase" | "synapse_usage" | "synapse_credit" | "usdc_in" | "usdc_out" | "other";
  amount: number; // signed
  unit: ActivityUnit;
  description: string;
  source: string;
  created_at: string;
}

const WalletDashboard = () => {
  const { balance, loading: balanceLoading, fiatProvisioned, usdcProvisioned, usdcAddress } = useWalletBalance();
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [isAddFundsOpen, setIsAddFundsOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchActivity();
    const startTime = Date.now();
    let channels: any[] = [];

    const setupRealtime = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const tables = ["transactions", "fiat_ledger", "synapse_credit_ledger"];
      tables.forEach((table) => {
        const ch = supabase
          .channel(`wallet-activity-${table}`)
          .on(
            "postgres_changes",
            { event: "INSERT", schema: "public", table, filter: `user_id=eq.${user.id}` },
            () => fetchActivity(),
          )
          .subscribe();
        channels.push(ch);
      });
    };

    setupRealtime();

    return () => {
      const duration = (Date.now() - startTime) / 1000;
      eventTracker.trackWalletView({
        view_duration: duration,
        balance_checked: true,
        transactions_viewed: activity.length,
      });
      channels.forEach((ch) => supabase.removeChannel(ch));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usdcAddress]);

  const fetchActivity = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setActivity([]);
        setLoading(false);
        return;
      }

      const addr = usdcAddress?.toLowerCase() ?? null;

      const [txRes, fiatRes, synRes, usdcRes] = await Promise.all([
        supabase.from("transactions").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(25),
        supabase.from("fiat_ledger").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(25),
        supabase.from("synapse_credit_ledger").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(25),
        addr
          ? supabase.from("usdc_payments").select("*").or(`sender_address.eq.${addr},recipient_address.eq.${addr}`).order("created_at", { ascending: false }).limit(25)
          : Promise.resolve({ data: [], error: null } as any),
      ]);

      const items: ActivityItem[] = [];

      (txRes.data ?? []).forEach((t: any) => {
        const type = t.transaction_type as string;
        let kind: ActivityItem["kind"] = "other";
        if (type === "earn" || type === "data_reward" || type === "data_earnings") kind = "earn";
        else if (type === "payment_sent") kind = "payment_sent";
        else if (type === "payment_received" || type === "payroll") kind = "payment_received";
        else if (type?.startsWith("governance")) kind = "governance";
        items.push({
          id: `tx-${t.id}`,
          kind,
          amount: Number(t.amount) || 0,
          unit: "usd",
          description: String(t.description ?? type).replace("Staged_data_reward", "Health Data Contribution"),
          source: t.source || "IDIA Platform",
          created_at: t.created_at,
        });
      });

      (fiatRes.data ?? []).forEach((f: any) => {
        const t = f.transaction_type as string;
        const amt = Number(f.amount_usd ?? f.amount) || 0;
        if (t === "DATA_SALE_PAYOUT") {
          items.push({
            id: `f-${f.id}`,
            kind: "royalty",
            amount: Math.abs(amt),
            unit: "usd",
            description: f.description || "Royalty payout",
            source: f.source || "IDIA Data Marketplace",
            created_at: f.created_at,
          });
        } else if (t === "CREDIT_PURCHASE") {
          items.push({
            id: `f-${f.id}`,
            kind: "credit_purchase",
            amount: -Math.abs(amt),
            unit: "usd",
            description: f.description || "Synapse credit purchase",
            source: f.source || "hub.thebigidia.com",
            created_at: f.created_at,
          });
        }
      });

      (synRes.data ?? []).forEach((s: any) => {
        const entry = String(s.entry_type ?? "").toLowerCase();
        const amt = Number(s.amount) || 0;
        const src = (s.metadata && (s.metadata.app || s.metadata.source)) || "Synapse";

        // Only surface meaningful credit movement, not the flood of pro-rata yield deposits.
        if (entry === "usage" || entry === "debit") {
          items.push({
            id: `s-${s.id}`,
            kind: "synapse_usage",
            amount: -Math.abs(amt),
            unit: "cr",
            description: s.description || "Synapse credit used",
            source: src,
            created_at: s.created_at,
          });
        }
      });

      if (addr) {
        (usdcRes.data ?? []).forEach((u: any) => {
          const incoming = String(u.recipient_address).toLowerCase() === addr;
          items.push({
            id: `u-${u.id}`,
            kind: incoming ? "usdc_in" : "usdc_out",
            amount: (incoming ? 1 : -1) * (Number(u.amount_usdc) || 0),
            unit: "usdc",
            description: incoming ? "USDC received" : `USDC sent${u.merchant_name ? ` · ${u.merchant_name}` : ""}`,
            source: u.network || "Base",
            created_at: u.created_at,
          });
        });
      }

      items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setActivity(items.slice(0, 25));
      setLoading(false);
    } catch (error) {
      console.error("Error fetching activity:", error);
      setActivity([]);
      setLoading(false);
    }
  };

  const getActivityIcon = (kind: ActivityItem["kind"]) => {
    switch (kind) {
      case "earn":
        return TrendingUp;
      case "royalty":
        return Sparkles;
      case "credit_purchase":
        return Coins;
      case "synapse_credit":
        return Coins;
      case "synapse_usage":
        return Zap;
      case "payment_sent":
      case "usdc_out":
        return ArrowUpRight;
      case "payment_received":
      case "usdc_in":
        return ArrowDownLeft;
      default:
        return CreditCard;
    }
  };

  const getTransactionColor = (amount: number) => (amount > 0 ? "text-green-600" : "text-red-600");

  const formatAmount = (amount: number, unit: ActivityUnit) => {
    const sign = amount > 0 ? "+" : amount < 0 ? "−" : "";
    const abs = Math.abs(amount);
    if (unit === "cr") {
      const rounded = abs >= 1 ? abs.toFixed(0) : abs.toFixed(2);
      return `${sign}${rounded} CR`;
    }
    if (unit === "usdc") return `${sign}${abs.toFixed(2)} USDC`;
    return `${sign}$${abs.toFixed(2)}`;
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);
    if (diffHours < 1) return "Just now";
    if (diffHours < 24) return `${diffHours} hours ago`;
    if (diffDays === 1) return "1 day ago";
    return `${diffDays} days ago`;
  };


  if (loading || balanceLoading) {
    // Added balanceLoading check
    return (
      <div className="p-4 space-y-6">
        <div className="animate-pulse">
          <div className="h-32 bg-gray-200 rounded-lg mb-6"></div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 rounded w-1/4"></div>
            <div className="h-16 bg-gray-200 rounded"></div>
            <div className="h-16 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6">
      <Card className="bg-gradient-to-br from-[hsl(178,42%,32%)] to-[hsl(178,42%,42%)] text-white border-none shadow-xl rounded-[2.5rem] overflow-hidden">
        <CardContent className="p-7">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-teal-100/60">
                Your Balances
              </p>
              <h2 className="text-4xl font-black">
                ${balance.usdc_balance.toFixed(2)}{" "}
                <span className="text-sm font-medium text-teal-100/40">USDC</span>
              </h2>
            </div>
            <CreditCard className="w-10 h-10 text-orange-400 drop-shadow-lg" />
          </div>
          <div className="mt-6 flex items-center gap-2 border-t border-white/10 pt-4">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[9px] font-black uppercase tracking-widest text-teal-50">
              IDIA · {balance.idia_token_balance.toLocaleString(undefined, { maximumFractionDigits: 4 })}
            </span>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900">Quick Actions</h3>
        <div className="grid grid-cols-2 gap-3">
          <Button className="bg-gradient-to-r from-teal-500 to-cyan-600 hover:from-teal-600 hover:to-cyan-700 py-6 rounded-xl">
            <div className="text-center">
              <ArrowUpRight className="w-6 h-6 mx-auto mb-1" />
              <span className="block text-sm font-semibold">Send Money</span>
            </div>
          </Button>
          <Button
            variant="outline"
            className="py-6 rounded-xl border-2 hover:bg-gray-50"
            onClick={() => setIsAddFundsOpen(true)}
          >
            <div className="text-center">
              <CreditCard className="w-6 h-6 mx-auto mb-1 text-gray-600" />
              <span className="block text-sm font-semibold text-gray-700">Add Funds</span>
            </div>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          {activity.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p className="text-lg font-medium">No recent activity</p>
              <p className="text-sm">Your transactions will appear here once you start using the platform.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {activity.map((item) => {
                const Icon = getActivityIcon(item.kind);
                return (
                  <div key={item.id} className="flex items-center space-x-3 py-1.5">
                    <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                      <Icon className="w-4 h-4 text-gray-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 text-sm truncate">{item.description}</p>
                      <p className="text-xs text-gray-500">
                        {formatTime(item.created_at)}
                        {item.source ? ` · ${item.source}` : ""}
                      </p>
                    </div>
                    <div className={`font-semibold text-sm ${getTransactionColor(item.amount)}`}>
                      {formatAmount(item.amount, item.unit)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

        </CardContent>
      </Card>

      <AddFundsModal
        isOpen={isAddFundsOpen}
        onClose={() => setIsAddFundsOpen(false)}
        fiatEnabled={fiatProvisioned}
        usdcEnabled={usdcProvisioned}
        usdcAddress={usdcAddress}
      />
    </div>
  );
};

export default WalletDashboard;
