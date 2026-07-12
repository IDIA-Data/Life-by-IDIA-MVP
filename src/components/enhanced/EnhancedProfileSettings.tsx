
import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useEnhancedProfile } from "@/hooks/useEnhancedProfile";
import { useWalletBalance } from "@/hooks/useWalletBalance";
import { Upload, Shield, Building, CreditCard } from "lucide-react";
import BusinessMembershipPanel from "./BusinessMembershipPanel";

const cardHeader = "py-2 px-3";
const cardTitle = "text-sm font-semibold flex items-center gap-2";
const cardBody = "px-3 pb-3 pt-0 space-y-2";

const EnhancedProfileSettings: React.FC = () => {
  const {
    profile,
    wallet: seedWallet,
    interests,
    availableInterests,
    loading,
    updating,
    updateProfile,
    updateInterests,
    uploadAvatar,
  } = useEnhancedProfile();

  const { balance } = useWalletBalance();

  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);

  useEffect(() => {
    setSelectedInterests(interests ? interests.map((i) => i.id) : []);
  }, [interests]);
  const [, setAvatarFile] = useState<File | null>(null);

  // 1. Setup matching cache-busting state
  const [avatarHash, setAvatarHash] = useState(Date.now());

  // 2. Listen to self-dispatched events ensuring total sync
  useEffect(() => {
    const handleAvatarUpdate = () => setAvatarHash(Date.now());
    window.addEventListener("avatar-updated", handleAvatarUpdate);
    return () => window.removeEventListener("avatar-updated", handleAvatarUpdate);
  }, []);

  if (loading) {
    return (
      <div className="p-3">
        <div className="animate-pulse space-y-2">
          <div className="h-6 bg-muted rounded w-1/3" />
          <div className="h-24 bg-muted rounded" />
          <div className="h-40 bg-muted rounded" />
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="p-3 text-center">
        <p className="text-muted-foreground text-sm">Profile not found</p>
      </div>
    );
  }

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setAvatarFile(file);
      // Ensure we await the upload before dispatching the refresh event
      await uploadAvatar(file);

      // 3. Dispatch global atomic event to instantly refresh Header & Settings avatars
      window.dispatchEvent(new Event("avatar-updated"));
    }
  };

  const handleInterestToggle = (interestId: string) => {
    setSelectedInterests((prev) =>
      prev.includes(interestId) ? prev.filter((id) => id !== interestId) : [...prev, interestId],
    );
  };

  const saveInterests = () => {
    updateInterests(selectedInterests);
  };

  const getKycStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive"> = {
      pending: "secondary",
      verified: "default",
      rejected: "destructive",
    };
    return <Badge variant={variants[status] || "secondary"}>{status}</Badge>;
  };

  const getAccountTypeBadge = (type: string) => {
    const labels: Record<string, string> = {
      personal: "Personal",
      business: "Business",
      "non-profit": "Non-Profit",
    };
    return (
      <Badge variant="outline" className="text-[11px]">
        {labels[type] || type}
      </Badge>
    );
  };

  // 4. Apply the cache-busted URL
  const avatarSrc = profile.avatar_url ? `${profile.avatar_url}?t=${avatarHash}` : "";

  return (
    <div className="p-2 sm:p-3 space-y-3 max-w-3xl mx-auto">
      {/* Profile */}
      <Card>
        <CardHeader className={cardHeader}>
          <div className="flex items-center justify-between">
            <CardTitle className={cardTitle}>
              <Upload className="w-4 h-4" />
              Profile Information
            </CardTitle>
            {getAccountTypeBadge(profile.account_type)}
          </div>
        </CardHeader>
        <CardContent className={cardBody}>
          <div className="flex items-center gap-3">
            <Avatar className="w-14 h-14">
              <AvatarImage src={avatarSrc} />
              <AvatarFallback>
                {profile.first_name?.[0]}
                {profile.last_name?.[0]}
              </AvatarFallback>
            </Avatar>
            <div>
              <input
                type="file"
                accept="image/*"
                onChange={handleAvatarUpload}
                className="hidden"
                id="avatar-upload"
                disabled={updating}
              />
              <Label htmlFor="avatar-upload" className="cursor-pointer">
                <Button variant="outline" size="sm" asChild>
                  <span>Change Avatar</span>
                </Button>
              </Label>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label htmlFor="display_name" className="text-xs">
                Display Name
              </Label>
              <Input
                id="display_name"
                className="h-8"
                value={profile.display_name || ""}
                onChange={(e) => updateProfile({ display_name: e.target.value })}
                placeholder="How others see you"
              />
            </div>
            <div>
              <Label htmlFor="ai_assistant_name" className="text-xs">
                AI Assistant Name
              </Label>
              <Input
                id="ai_assistant_name"
                className="h-8"
                value={profile.ai_assistant_name || ""}
                onChange={(e) => updateProfile({ ai_assistant_name: e.target.value })}
                placeholder="Friend"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-x-3 gap-y-1 border-t pt-2">
            <div>
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Legal Name</p>
              <p className="text-sm font-medium">
                {profile.first_name} {profile.last_name}
              </p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Email</p>
              <p className="text-sm font-medium truncate">{profile.email}</p>
            </div>
            {profile.date_of_birth && (
              <div>
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Date of Birth</p>
                <p className="text-sm font-medium">{new Date(profile.date_of_birth).toLocaleDateString()}</p>
              </div>
            )}
            {profile.phone_number && (
              <div>
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Phone</p>
                <p className="text-sm font-medium">{profile.phone_number}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Verification & Trust (merged) */}
      <Card>
        <CardHeader className={cardHeader}>
          <CardTitle className={cardTitle}>
            <Shield className="w-4 h-4" />
            Verification & Trust
          </CardTitle>
        </CardHeader>
        <CardContent className={cardBody}>
          <div className="space-y-1">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">KYC Status</p>
            <div>{getKycStatusBadge(profile.kyc_status)}</div>
            {profile.kyc_status === "pending" && (
              <p className="text-xs text-muted-foreground">Complete verification to unlock all features.</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Wallet */}
      <Card>
        <CardHeader className={cardHeader}>
          <CardTitle className={cardTitle}>Wallet Information</CardTitle>
        </CardHeader>
        <CardContent className={cardBody}>
          <div className="grid grid-cols-3 gap-2">
            <div className="text-center p-2 bg-muted rounded-md">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Cash</p>
              <p className="text-base font-semibold">${(balance.cash_balance || 0).toFixed(2)}</p>
            </div>
            <div className="text-center p-2 bg-muted rounded-md">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">IDIA-USD</p>
              <p className="text-base font-semibold">${(balance.usdc_balance || 0).toFixed(2)}</p>
            </div>
            <div className="text-center p-2 bg-muted rounded-md">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">IDIA Tokens</p>
              <p className="text-base font-semibold">{(balance.idia_token_balance || 0).toFixed(2)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Shield className="w-3 h-3" />
            Seed Backup: {seedWallet?.is_seed_backed_up ? "Completed" : "Not backed up"}
          </div>
        </CardContent>
      </Card>

      {/* Account Management */}
      <Card>
        <CardHeader className={cardHeader}>
          <CardTitle className={cardTitle}>
            <Building className="w-4 h-4" />
            Account Management
          </CardTitle>
        </CardHeader>
        <CardContent className={cardBody}>
          <BusinessMembershipPanel />
        </CardContent>
      </Card>

      {/* Interests */}
      <Card>
        <CardHeader className={cardHeader}>
          <CardTitle className={cardTitle}>Your Interests</CardTitle>
        </CardHeader>
        <CardContent className={cardBody}>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1.5">
            {availableInterests.map((interest) => (
              <Button
                key={interest.id}
                variant={selectedInterests.includes(interest.id) ? "default" : "outline"}
                size="sm"
                onClick={() => handleInterestToggle(interest.id)}
                className="text-xs h-8"
              >
                {interest.name}
              </Button>
            ))}
          </div>
          <div className="flex justify-end">
            <Button onClick={saveInterests} disabled={updating} size="sm">
              Save Interests
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default EnhancedProfileSettings;
