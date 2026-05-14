import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface EnhancedProfile {
  id: string;
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  account_type: string;
  display_name: string | null;
  avatar_url: string | null;
  phone_number: string | null;
  date_of_birth: string | null;
  trust_score: number | null;
  available_credit_line: number | null;
  quiet_time_enabled: boolean;
  quiet_time_start: string | null;
  quiet_time_end: string | null;
  ai_assistant_name: string;
  created_at: string;
  updated_at: string;
  kyc_status?: string;
  ssn_last4?: string;
  wallet_address?: string; // ADD THIS LINE
  fbo_account_id?: string;
  full_legal_address?: Record<string, any> | null;
}

export interface WalletData {
  id: string;
  user_id: string;
  wallet_address: string | null;
  cash_balance: number;
  idia_usd_balance: number;
  idia_token_balance: number;
  is_seed_backed_up: boolean;
}

export interface UserInterests {
  id: string;
  name: string;
  category: string | null;
}

export const useEnhancedProfile = () => {
  const [profile, setProfile] = useState<EnhancedProfile | null>(null);
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [interests, setInterests] = useState<UserInterests[]>([]);
  const [availableInterests, setAvailableInterests] = useState<UserInterests[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const { toast } = useToast();

  // ATOMIC SYNC: Listen for profile updates dispatched from other instances of this hook
  useEffect(() => {
    const handleProfileSync = (event: Event) => {
      const customEvent = event as CustomEvent;
      if (customEvent.detail?.profile) {
        setProfile((prev) => ({ ...prev, ...customEvent.detail.profile }));
      }
    };
    window.addEventListener("idia-profile-sync", handleProfileSync);
    return () => window.removeEventListener("idia-profile-sync", handleProfileSync);
  }, []);

  useEffect(() => {
    loadProfileData();
    loadAvailableInterests();
  }, []);

  const loadProfileData = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (profileError && profileError.code !== "PGRST116") {
        console.error("Error loading profile:", profileError);
      } else if (profileData) {
        const p = profileData as any; // Cast to any to resolve TS2339 property errors
        const displayName = user.user_metadata?.display_name || user.user_metadata?.full_name || user.email || "";

        setProfile({
          id: p.id,
          user_id: p.user_id,
          first_name: user.user_metadata?.first_name || displayName.split(" ")[0] || "",
          last_name: user.user_metadata?.last_name || displayName.split(" ").slice(1).join(" ") || "",
          email: user.email,
          ai_assistant_name: p.ai_assistant_name || "Friend",
          account_type: p.account_type || "individual",
          display_name: displayName,
          avatar_url: p.avatar_url,
          phone_number: p.phone_number || null,
          date_of_birth: p.date_of_birth || null,
          trust_score: p.trust_score,
          available_credit_line: p.available_credit_line || 0,
          quiet_time_enabled: p.quiet_time_enabled || false,
          quiet_time_start: p.quiet_time_start,
          quiet_time_end: p.quiet_time_end,
          created_at: p.created_at,
          updated_at: p.updated_at,
          kyc_status: p.kyc_status || "pending",
          ssn_last4: p.ssn_last4 || null,
          
          fbo_account_id: p.fbo_account_id || null,
        });
      }

      const { data: walletData } = await supabase
        .from("wallets")
        .select("id, user_id, wallet_address, cash_balance, idia_usd_balance, idia_token_balance")
        .eq("user_id", user.id)
        .maybeSingle();

      if (walletData) {
        const w = walletData as any;
        setWallet({
          id: w.id,
          user_id: w.user_id,
          wallet_address: w.wallet_address || null,
          cash_balance: Number(w.cash_balance) || 0,
          idia_usd_balance: Number(w.idia_usd_balance) || 0,
          idia_token_balance: Number(w.idia_token_balance) || 0,
          is_seed_backed_up: false,
        });
      }
    } catch (error) {
      console.error("Error loading profile data:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadAvailableInterests = async () => {
    setAvailableInterests([
      { id: "1", name: "Health & Fitness", category: "lifestyle" },
      { id: "2", name: "Technology", category: "professional" },
      { id: "3", name: "Finance", category: "professional" },
      { id: "4", name: "Travel", category: "lifestyle" },
    ]);
  };

  const updateProfile = async (updates: Partial<EnhancedProfile>) => {
    setUpdating(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("No user found");

      const { trust_score, available_credit_line, ...rest } = updates;

      // Safe defaults guarantee the row satisfies profiles_account_type_check
      // (allowed: individual | business | enterprise) on first INSERT.
      const { data, error } = await (supabase.from("profiles") as any)
        .upsert(
          {
            id: user.id,
            user_id: user.id,
            platform_guid: user.id,
            account_type: "individual",
            ai_assistant_name: "Friend",
            kyc_tier: 1,
            ...rest,
            trust_score: trust_score,
            available_credit_line: available_credit_line,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" },
        )
        .select()
        .single();

      if (error) throw error;

      // ATOMIC SYNC: Compile the new state, set locally, and broadcast globally
      const updatedProfile = {
        ...(profile || {}),
        ...updates,
        ...(data as any),
      } as EnhancedProfile;

      setProfile(updatedProfile);
      window.dispatchEvent(new CustomEvent("idia-profile-sync", { detail: { profile: updatedProfile } }));

      toast({
        title: "Success",
        description: "Profile updated successfully",
      });
    } catch (error: any) {
      console.error("Error updating profile:", error.message);
      toast({
        title: "Error",
        description: "Failed to update profile",
        variant: "destructive",
      });
    } finally {
      setUpdating(false);
    }
  };

  const updateInterests = async (selectedInterestIds: string[]) => {
    setUpdating(true);
    try {
      setInterests(availableInterests.filter((interest) => selectedInterestIds.includes(interest.id)));
      toast({
        title: "Success",
        description: "Interests updated successfully",
      });
    } catch (error) {
      console.error("Error updating interests:", error);
    } finally {
      setUpdating(false);
    }
  };

  const uploadAvatar = async (file: File) => {
    setUpdating(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("No user found");

      const fileExt = (file.name.split(".").pop() || "png").toLowerCase();
      // Folder must be the user's id so RLS (storage.foldername(name))[1] = auth.uid() passes.
      const filePath = `${user.id}/avatar.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file, { upsert: true, contentType: file.type });

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from("avatars").getPublicUrl(filePath);

      // Cache-bust so the new image swaps in immediately.
      const bustedUrl = `${publicUrl}?t=${Date.now()}`;

      // This will automatically trigger the global idia-profile-sync event inside updateProfile
      await updateProfile({ avatar_url: bustedUrl });

      toast({
        title: "Avatar updated",
        description: "Your profile picture has been changed.",
      });
    } catch (error: any) {
      console.error("Error uploading avatar:", error);
      toast({
        title: "Upload failed",
        description: error?.message || "Could not upload avatar.",
        variant: "destructive",
      });
    } finally {
      setUpdating(false);
    }
  };

  return {
    profile,
    wallet,
    interests,
    availableInterests,
    loading,
    updating,
    updateProfile,
    updateInterests,
    uploadAvatar,
    reload: loadProfileData,
  };
};
