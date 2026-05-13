import { useState, useEffect } from "react";
import { ArrowUpRight, ArrowDownLeft, CreditCard, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import AddFundsModal from "./AddFundsModal";
import { eventTracker } from "@/utils/EventTracker";
import { useWalletBalance } from "@/hooks/useWalletBalance"; // Added import

interface Transaction {
  id: string;
  transaction_type: string;
  amount: number;
  description: string;
  source: string;
  created_at: string;
}

const WalletDashboard = () => {
  // Integrated real-time hook and removed static balances state
  const { balance, loading: balanceLoading, fiatProvisioned, usdcProvisioned, usdcAddress } = useWalletBalance();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isAddFundsOpen, setIsAddFundsOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Removed fetchBalances() call as the hook now handles this
    fetchTransactions();

    const startTime = Date.now();

    // DISCUSSION: Added Realtime Subscription for Live Transaction Updates
    let transactionChannel: any;

    const setupRealtime = async () => {
      const {
        data: { user },
        // @ts-ignore -
      } = await supabase.auth.getUser();
      if (!user) return;

      transactionChannel = supabase
        .channel("wallet-live-transactions")
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "transactions",
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            console.log("New Transaction Live!", payload);
            // Refresh transactions list when a new one hits
            fetchTransactions();
          },
        )
        .subscribe();
    };

    setupRealtime();

    return () => {
      const duration = (Date.now() - startTime) / 1000;
      eventTracker.trackWalletView({
        view_duration: duration,
        balance_checked: true,
        transactions_viewed: transactions.length,
      });

      // DISCUSSION: Cleanup subscription on unmount
      if (transactionChannel) supabase.removeChannel(transactionChannel);
    };
  }, []);

  // Removed fetchBalances function definition to prevent redundant logic

  const fetchTransactions = async () => {
    try {
      const {
        data: { user },
        // @ts-ignore -
      } = await supabase.auth.getUser();
      if (!user) {
        setTransactions([]);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) {
        console.log("Error fetching transactions:", error);
        setTransactions([]);
      } else {
        setTransactions(
          (data || []).map((transaction) => ({
            ...transaction,
            description: transaction.description.replace("Staged_data_reward", "Health Data Contribution"),
            source: transaction.source || "IDIA Platform",
          })),
        );
      }
      setLoading(false);
    } catch (error) {
      console.error("Error fetching transactions:", error);
      setTransactions([]);
      setLoading(false);
    }
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case "data_reward":
      case "data_earnings":
        return TrendingUp;
      case "payment_sent":
        return ArrowUpRight;
      case "payment_received":
      case "payroll":
        return ArrowDownLeft;
      default:
        return CreditCard;
    }
  };

  const getTransactionColor = (amount: number) => {
    return amount > 0 ? "text-green-600" : "text-red-600";
  };

  const formatAmount = (amount: number) => {
    const sign = amount > 0 ? "+" : "";
    return `${sign}$${Math.abs(amount).toFixed(2)}`;
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffHours < 1) {
      return "Just now";
    } else if (diffHours < 24) {
      return `${diffHours} hours ago`;
    } else if (diffDays === 1) {
      return "1 day ago";
    } else {
      return `${diffDays} days ago`;
    }
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
      <Card className="bg-gradient-to-r from-teal-500 to-cyan-600 text-white overflow-hidden">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold">Your Balances</h2>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <p className="text-teal-100 text-xs font-medium">Cash</p>
              {/* Updated to use balance from hook */}
              <p className="text-xl font-bold">${balance.cash_balance.toFixed(2)}</p>
            </div>
            <div className="text-center">
              <p className="text-teal-100 text-xs font-medium">USDC</p>
              {/* Updated to use balance from hook */}
              <p className="text-xl font-bold">${balance.usdc_balance.toFixed(2)}</p>
            </div>
            <div className="text-center">
              <p className="text-teal-100 text-xs font-medium">IDIA Token</p>
              {/* Updated to use balance from hook */}
              <p className="text-xl font-bold">{balance.idia_token_balance.toFixed(2)}</p>
            </div>
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
          {transactions.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p className="text-lg font-medium">No recent activity</p>
              <p className="text-sm">Your transactions will appear here once you start using the platform.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {transactions.map((transaction) => {
                const Icon = getTransactionIcon(transaction.transaction_type);
                return (
                  <div key={transaction.id} className="flex items-center space-x-3 py-1.5">
                    <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                      <Icon className="w-4 h-4 text-gray-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 text-sm truncate">{transaction.description}</p>
                      <p className="text-xs text-gray-500">{formatTime(transaction.created_at)}</p>
                    </div>
                    <div className={`font-semibold text-sm ${getTransactionColor(transaction.amount)}`}>
                      {formatAmount(transaction.amount)}
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
