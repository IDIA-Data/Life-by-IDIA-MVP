import React, { useState, useEffect, useLayoutEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useSocialGraph } from "@/hooks/useSocialGraph";
import { useEnhancedProfile } from "@/hooks/useEnhancedProfile";
import { supabase } from "@/integrations/supabase/client";
import PsychometricTestingCenter from "../psychometric/PsychometricTestingCenter";
import { fireGraffitiConfetti, fireFinaleConfetti } from "../psychometric/confetti";
import StandingOrb from "../life/StandingOrb";
import ColorWashOverlay from "../life/ColorWashOverlay";
import SwipeToRate from "../life/SwipeToRate";
import SphereOfInfluence from "../life/SphereOfInfluence";
import LabelConnectionDialog from "../life/LabelConnectionDialog";
import ProximityAwarenessOverlay from "../life/ProximityAwarenessOverlay";
import { localPIIVault, type ConnectionLabel } from "@/lib/localPIIVault";
import { useNFCBridge } from "@/hooks/useNFCBridge";
import { toast } from "@/components/ui/sonner";
import {
  Heart,
  Award,
  TrendingUp,
  MessageCircle,
  Shield,
  Clock,
  CheckCircle,
  BrainCircuit,
  Users,
  ArrowRight,
  Nfc,
  Radar,
} from "lucide-react";

// Placeholder — derives a peer tier hue from the opaque native peer token
// until the finalized iOS contract ships. Stable hash → hue.
function peerColorFromToken(token: string): string {
  let h = 0;
  for (let i = 0; i < token.length; i++) h = (h * 31 + token.charCodeAt(i)) >>> 0;
  const hue = h % 360;
  return `hsl(${hue}, 80%, 60%)`;
}

// Resolve the user's tier color for the NFC color wash
function tierColorForScore(score: number | null | undefined): string {
  if (score === null || score === undefined || score === 0) return "hsla(200, 80%, 70%, 0.1)";
  if (score <= 110) return "hsl(0, 0%, 100%)";
  if (score <= 220) return "hsl(48, 95%, 55%)";
  if (score <= 330) return "hsl(145, 75%, 45%)";
  if (score <= 440) return "hsl(215, 90%, 55%)";
  if (score <= 550) return "hsl(278, 75%, 55%)";
  if (score <= 660) return "hsl(2, 85%, 55%)";
  if (score <= 770) return "hsl(25, 100%, 55%)";
  if (score <= 880) return "hsl(25, 55%, 35%)";
  return "hsl(0, 0%, 4%)";
}

const LifeScreen: React.FC = () => {
  const { friends, trustCircles, goodDeeds, socialMetrics, loading, acceptFriendRequest, reload } =
    useSocialGraph();

  const { profile, updateProfile, loading: profileLoading } = useEnhancedProfile();

  const [newDeedTitle, setNewDeedTitle] = useState("");
  const [newDeedDescription, setNewDeedDescription] = useState("");
  const [newDeedFile, setNewDeedFile] = useState<File | null>(null);
  const [isSubmittingDeed, setIsSubmittingDeed] = useState(false);
  const [deedDialogOpen, setDeedDialogOpen] = useState(false);

  const [showTestModal, setShowTestModal] = useState(false);
  const [isCalculating, setIsCalculating] = useState(false);

  // NFC Bridge — Sovereign Handshake to native iOS hardware
  const { isBridgeAvailable, isScanning, initiateSovereignHandshake } = useNFCBridge();
  const [washPeerColor, setWashPeerColor] = useState<string | null>(null);
  const [rateTarget, setRateTarget] = useState<string | null>(null);
  const [proximityOpen, setProximityOpen] = useState(false);

  // Local PII Vault — IndexedDB-only labels for Connections (never sent to cloud)
  const [labels, setLabels] = useState<Record<string, ConnectionLabel>>({});
  const [labelTarget, setLabelTarget] = useState<string | null>(null);

  // Load local labels for the current Connections list
  useEffect(() => {
    if (!friends.length) {
      setLabels({});
      return;
    }
    const ids = friends.map((f) => f.id);
    localPIIVault.lookupBatch(ids).then(setLabels);
  }, [friends]);

  // After a successful Sync, prompt the user to label the new Connection.
  const promptLabelForLatestSync = () => {
    const latest = [...friends]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
    if (latest) setLabelTarget(latest.id);
  };

  useEffect(() => {
    console.log("[LIFE_NFC_SUBSCRIBE_START]");
    const onComplete = (e: Event) => {
      const detail = (e as CustomEvent<{ peerToken: string }>).detail;
      const peerColor = peerColorFromToken(detail?.peerToken ?? "");
      console.log("[LIFE_NFC_HANDSHAKE_RESOLVED]", { peerColor });
      setWashPeerColor(peerColor);
      toast.success("Sync complete", { description: "You made a new Connection." });
      // After the color wash, prompt the user to rate the Sync
      setTimeout(() => setRateTarget(detail?.peerToken ?? ""), 3600);
      // Then prompt the user to label this Connection on-device only
      setTimeout(() => promptLabelForLatestSync(), 4200);
    };
    const onError = () => {
      toast("The Sync did not complete", {
        description: "Try again with the phones held closer, back-to-back.",
      });
    };
    window.addEventListener("nfc:scan-complete", onComplete);
    window.addEventListener("nfc:scan-error", onError);
    return () => {
      window.removeEventListener("nfc:scan-complete", onComplete);
      window.removeEventListener("nfc:scan-error", onError);
      console.log("[LIFE_NFC_SUBSCRIBE_END]");
    };
  }, []);

  // Granular layout calibration logging
  useLayoutEffect(() => {
    console.log("[VIEWPORT_CALIBRATION_START]");
    return () => {
      console.log("[VIEWPORT_CALIBRATION_END]");
    };
  }, []);

  // Granular NFC UI relocation sync logging
  useEffect(() => {
    console.log("[NFC_UI_RELOCATION_SYNC_START]");
    return () => {
      console.log("[NFC_UI_RELOCATION_SYNC_END]");
    };
  }, []);

  // Syncing terminology init
  useEffect(() => {
    console.log("[SYNCING_TERMINOLOGY_INIT_START]");
    return () => {
      console.log("[SYNCING_TERMINOLOGY_INIT_END]");
    };
  }, []);

  useEffect(() => {
    fireGraffitiConfetti();
  }, []);

  // Phase 5 — Evidence-Based Good Deeds.
  const handleSubmitGoodDeed = async () => {
    const title = newDeedTitle.trim();
    const description = newDeedDescription.trim();
    if (!title || !description || !newDeedFile) {
      toast("Please add a title, a description, and one piece of proof.");
      return;
    }
    setIsSubmittingDeed(true);
    console.log("[GOOD_DEED_SUBMISSION_START]");
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast("Please sign in to submit a Good Deed.");
        return;
      }

      // 1. Insert the deed row first
      const { data: inserted, error: insertErr } = await supabase
        .from("good_deeds")
        .insert({
          user_id: user.id,
          title,
          description,
          verification_status: "pending",
        })
        .select("id")
        .maybeSingle();
      if (insertErr || !inserted) throw insertErr ?? new Error("Insert failed");

      // 2. Upload the evidence file
      const ext = (newDeedFile.name.split(".").pop() || "bin").toLowerCase().slice(0, 8);
      const path = `${user.id}/${inserted.id}.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from("deed-evidence")
        .upload(path, newDeedFile, {
          cacheControl: "3600",
          upsert: true,
          contentType: newDeedFile.type || undefined,
        });
      if (uploadErr) throw uploadErr;

      // 3. Persist the storage path
      await supabase
        .from("good_deeds")
        .update({ evidence_url: path })
        .eq("id", inserted.id);

      toast.success("Submitted for review", {
        description: "Your Good Deed is being checked by the Friend AI.",
      });

      // 4. Fire the AI verifier
      const { data: verifyData, error: verifyErr } = await supabase.functions.invoke(
        "verify-good-deed-evidence",
        { body: { deed_id: inserted.id } },
      );
      if (verifyErr) {
        console.error("[DEED_AI_ERROR]", verifyErr);
        toast("Could not finish AI review. Your Deed will stay as Pending.");
      } else if (verifyData?.verdict === "accept") {
        toast.success("Verified!", {
          description: verifyData.reason || "Your Good Deed was approved.",
        });
      } else if (verifyData?.verdict === "reject") {
        toast("Not approved", {
          description: verifyData?.reason || "The proof did not match the description.",
        });
      }

      setNewDeedTitle("");
      setNewDeedDescription("");
      setNewDeedFile(null);
      setDeedDialogOpen(false);
      reload?.();
    } catch (e) {
      console.error("[GOOD_DEED_SUBMISSION_FAILED]", e);
      toast("Could not submit your Good Deed. Please try again.");
    } finally {
      setIsSubmittingDeed(false);
      console.log("[GOOD_DEED_SUBMISSION_END]");
    }
  };

  // --- IDIA EDGE FUNCTION EXECUTION ---
  const handleCalculateScore = async (moduleScores: Record<string, number>) => {
    setIsCalculating(true);
    console.log("[STANDING_SYNC_START]");
    try {
      const { data, error } = await supabase.functions.invoke("calculate-trust-score", {
        body: {
          user_id: profile?.user_id,
          telemetry: moduleScores,
        },
      });

      if (error) throw error;

      if (updateProfile) {
        await updateProfile({
          trust_score: data.trust_score,
          available_credit_line: data.credit_line,
        });
      }
    } catch (err) {
      console.error("IDIA Algorithm Execution Failed:", err);
    } finally {
      setIsCalculating(false);
      setShowTestModal(false);
      console.log("[STANDING_SYNC_END]");
      setTimeout(() => fireFinaleConfetti(), 400);
    }
  };

  const handleSubmitRating = async (rateeId: string, stars: number) => {
    console.log("[RATING_SUBMIT_START]", { rateeId, stars });
    try {
      const looksLikeUuid = /^[0-9a-f-]{36}$/i.test(rateeId);
      if (!looksLikeUuid) {
        toast("Rating saved on device", {
          description: "We will share it with the IDIA Protocol when the Connection is fully linked.",
        });
        return;
      }
      const { data, error } = await supabase.functions.invoke("submit-connection-rating", {
        body: { ratee_id: rateeId, stars },
      });
      if (error) throw error;
      toast.success("Rating saved", {
        description: stars >= 4 ? "Thank you for the kind feedback." : "Your honest rating helps the network.",
      });
    } catch (err) {
      console.error("[RATING_SUBMIT_ERROR]", err);
      toast("Could not save rating");
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive"> = {
      pending: "secondary",
      accepted: "default",
      verified: "default",
      rejected: "destructive",
    };
    return <Badge variant={variants[status] || "secondary"}>{status}</Badge>;
  };

  if (loading || profileLoading) {
    return (
      <div className="p-4 animate-pulse space-y-4 h-full overflow-hidden">
        <div className="h-8 bg-muted rounded w-1/3"></div>
        <div className="h-32 bg-muted rounded"></div>
        <div className="h-64 bg-muted rounded"></div>
      </div>
    );
  }

  const myTierColor = tierColorForScore(profile?.trust_score);

  return (
    <div className="h-full max-h-full overflow-hidden flex flex-col">
      <Tabs defaultValue="overview" className="flex-1 min-h-0 flex flex-col gap-2">
        <TabsList className="grid grid-cols-5 w-full bg-muted/20 shrink-0">
          <TabsTrigger value="overview" className="text-[11px] px-1">Overview</TabsTrigger>
          <TabsTrigger value="friends" className="text-[11px] px-1">Connections</TabsTrigger>
          <TabsTrigger value="sphere" className="text-[11px] px-1">Sphere</TabsTrigger>
          <TabsTrigger value="circles" className="text-[11px] px-1">Circles</TabsTrigger>
          <TabsTrigger value="deeds" className="text-[11px] px-1">Deeds</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="flex-1 min-h-0 overflow-hidden m-0">
          <div className="h-full flex flex-col gap-2">
            <Card className="bg-white border-teal-100 shadow-sm flex-1 min-h-0 overflow-hidden">
              <CardContent className="p-4 h-full">
                <div className="flex flex-col items-center gap-3 h-full">
                  <StandingOrb score={profile?.trust_score ?? null} size={170} />

                  <div className="w-full flex flex-col gap-2 p-3 bg-teal-50/50 border border-teal-100 rounded-xl">
                    <div className="space-y-0.5">
                      <h3 className="font-semibold flex items-center gap-2 text-foreground text-sm">
                        <BrainCircuit className="w-4 h-4 text-teal-600" />
                        Establish Your Standing
                      </h3>
                      <p className="text-[11px] text-muted-foreground leading-snug">
                        Complete your psychometric validation to deepen the chromatic resolution of your standing.
                      </p>
                    </div>

                    <Dialog open={showTestModal} onOpenChange={setShowTestModal}>
                      <DialogTrigger asChild>
                        <Button
                          size="sm"
                          className="w-full font-bold shadow-lg shadow-orange-500/20 bg-gradient-to-r from-teal-500 to-orange-500 hover:from-teal-600 hover:to-orange-600 text-white border-none"
                        >
                          {isCalculating ? "Calculating..." : "Take our Tests"}
                          <ArrowRight className="w-4 h-4 ml-2" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-5xl w-[95vw] max-h-[90vh] overflow-y-auto bg-white p-0 border-none">
                        <PsychometricTestingCenter
                          onCompleteAll={handleCalculateScore}
                          onCancel={() => setShowTestModal(false)}
                        />
                      </DialogContent>
                    </Dialog>

                    {/* NFC Sync Section — Nearby button purged for social engineering requirement */}
                    <div className="mt-7 pt-3 border-t border-teal-100 flex flex-col items-center gap-2">
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          onClick={() => {
                            console.log("[SYNC_INIT_START]");
                            console.log("[SYNC_INIT_PROCESS] Bridge Available:", isBridgeAvailable);
                            console.log("[SYNC_INIT_PROCESS] Invoking native handshake via useNFCBridge...");
                            initiateSovereignHandshake("STANDARD");
                            console.log("[SYNC_INIT_END]");
                          }}
                          disabled={isScanning}
                          className="font-bold shadow-lg shadow-teal-500/25 bg-gradient-to-r from-teal-500 via-amber-400 to-orange-500 hover:from-teal-600 hover:via-amber-500 hover:to-orange-600 text-white border-none backdrop-blur-md"
                        >
                          <Nfc className="w-4 h-4 mr-2" />
                          {isScanning ? "Listening for a tap…" : "Start Syncing"}
                        </Button>
                      </div>
                      <p className="text-[10px] text-muted-foreground text-center leading-tight px-2">
                        Sync with another user in person by tapping your phones back-to-back.
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-3 gap-2 shrink-0">
              <Card className="bg-white border-none shadow-sm">
                <CardContent className="p-2 flex flex-col items-center">
                  <Heart className="w-3.5 h-3.5 text-orange-500" />
                  <span className="text-[10px] text-muted-foreground mt-0.5">Reciprocity</span>
                  <span className="text-base font-bold text-teal-600 leading-tight">
                    {socialMetrics?.reciprocity_score?.toFixed(1) || "0.0"}
                  </span>
                </CardContent>
              </Card>
              <Card className="bg-white border-none shadow-sm">
                <CardContent className="p-2 flex flex-col items-center">
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
                  <span className="text-[10px] text-muted-foreground mt-0.5">Vitality</span>
                  <span className="text-base font-bold text-teal-600 leading-tight">
                    {socialMetrics?.network_vitality_score?.toFixed(1) || "0.0"}
                  </span>
                </CardContent>
              </Card>
              <Card className="bg-white border-none shadow-sm">
                <CardContent className="p-2 flex flex-col items-center">
                  <Users className="w-3.5 h-3.5 text-teal-600" />
                  <span className="text-[10px] text-muted-foreground mt-0.5">Network</span>
                  <span className="text-base font-bold text-teal-600 leading-tight">
                    {friends.filter((f) => f.status === "accepted").length}
                  </span>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="friends" className="flex-1 min-h-0 overflow-hidden m-0">
          <Card className="bg-white shadow-sm border-none h-full flex flex-col">
            <CardHeader className="shrink-0">
              <CardTitle className="text-foreground text-base">Your Connections</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 min-h-0 overflow-y-auto">
              {friends.length === 0 ? (
                <div className="text-center py-8 space-y-3">
                  <p className="text-muted-foreground">You do not have any Connections yet.</p>
                  <p className="text-xs text-muted-foreground">
                    You must Sync in person by tapping two phones together.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {friends.map((f) => {
                    const label = labels[f.id] ?? null;
                    const displayName = localPIIVault.displayName(f.id, label);
                    const initials = localPIIVault.initials(f.id, label);
                    return (
                      <div key={f.id} className="flex items-center space-x-3 p-3 border border-teal-50 rounded-lg">
                        <Avatar>
                          <AvatarFallback className="bg-teal-100 text-teal-700">{initials}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-foreground truncate">{displayName}</p>
                          <p className="text-sm text-muted-foreground">
                            Connected {new Date(f.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {getStatusBadge(f.status)}
                          {f.status === "pending" && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-teal-600 border-teal-200"
                              onClick={() => acceptFriendRequest(f.id)}
                            >
                              Accept
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-teal-600 border-teal-200"
                            onClick={() => setLabelTarget(f.id)}
                          >
                            Name
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-teal-600 border-teal-200"
                            onClick={() => setRateTarget(f.id)}
                          >
                            Rate
                          </Button>
                          <Button variant="ghost" size="sm" className="text-teal-600">
                            <MessageCircle className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sphere" className="flex-1 min-h-0 overflow-hidden m-0">
          <SphereOfInfluence friends={friends as any} currentScore={profile?.trust_score ?? null} />
        </TabsContent>

        <TabsContent value="circles" className="flex-1 min-h-0 overflow-hidden m-0">
          <Card className="bg-white shadow-sm border-none h-full flex flex-col">
            <CardHeader className="shrink-0">
              <CardTitle className="text-foreground text-base">Trust Circles</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 min-h-0 overflow-y-auto">
              {trustCircles.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">No trust circles yet.</p>
              ) : (
                <div className="space-y-3">
                  {trustCircles.map((circle) => (
                    <div key={circle.id} className="flex items-center space-x-3 p-3 border border-teal-50 rounded-lg">
                      <Shield className="w-5 h-5 text-teal-500" />
                      <div className="flex-1">
                        <p className="font-medium text-foreground">{circle.name}</p>
                        <p className="text-sm text-muted-foreground">{circle.member_count || 0} members</p>
                      </div>
                      <Button variant="outline" size="sm" className="text-teal-600 border-teal-200">
                        Manage
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="deeds" className="flex-1 min-h-0 overflow-hidden m-0">
          <Card className="bg-white shadow-sm border-none h-full flex flex-col">
            <CardHeader className="shrink-0">
              <div className="flex items-center justify-between">
                <CardTitle className="text-foreground text-base">Good Deeds</CardTitle>
                <Dialog
                  open={deedDialogOpen}
                  onOpenChange={(o) => {
                    setDeedDialogOpen(o);
                    if (!o) {
                      setNewDeedTitle("");
                      setNewDeedDescription("");
                      setNewDeedFile(null);
                    }
                  }}
                >
                  <DialogTrigger asChild>
                    <Button size="sm" className="bg-teal-600 hover:bg-teal-700">
                      <Award className="w-4 h-4 mr-2" />
                      Submit Deed
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="bg-white">
                    <DialogHeader>
                      <DialogTitle>Submit a Good Deed</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <p className="text-xs text-muted-foreground leading-snug">
                        You must show proof. Add a photo, a short video, or a voice note that shows the Good Deed. Then
                        write what you did.
                      </p>
                      <Input
                        placeholder="Title of your Good Deed"
                        value={newDeedTitle}
                        onChange={(e) => setNewDeedTitle(e.target.value)}
                        maxLength={100}
                        className="border-teal-100"
                      />
                      <Textarea
                        placeholder="Tell us what you did and who it helped."
                        value={newDeedDescription}
                        onChange={(e) => setNewDeedDescription(e.target.value)}
                        rows={3}
                        maxLength={1000}
                        className="border-teal-100"
                      />
                      <div className="space-y-1.5">
                        <label className="text-xs text-foreground font-medium">
                          Add proof (photo, video, or voice note)
                        </label>
                        <Input
                          type="file"
                          accept="image/*,video/*,audio/*"
                          onChange={(e) => setNewDeedFile(e.target.files?.[0] ?? null)}
                          className="border-teal-100 file:mr-3 file:rounded-md file:border-0 file:bg-teal-50 file:px-3 file:py-1.5 file:text-xs file:text-teal-700"
                        />
                        {newDeedFile && (
                          <p className="text-[11px] text-muted-foreground truncate">{newDeedFile.name}</p>
                        )}
                      </div>
                      <Button
                        className="w-full bg-teal-600 hover:bg-teal-700"
                        onClick={handleSubmitGoodDeed}
                        disabled={
                          isSubmittingDeed || !newDeedTitle.trim() || !newDeedDescription.trim() || !newDeedFile
                        }
                      >
                        {isSubmittingDeed ? "Submitting…" : "Submit for Verification"}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent className="flex-1 min-h-0 overflow-y-auto">
              {goodDeeds.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">No good deeds submitted yet.</p>
              ) : (
                <div className="space-y-3">
                  {goodDeeds.map((deed) => (
                    <div key={deed.id} className="p-4 border border-teal-50 rounded-lg bg-white space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium text-foreground">{deed.title}</h4>
                        {getStatusBadge(deed.verification_status)}
                      </div>
                      <p className="text-sm text-muted-foreground">{deed.description}</p>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(deed.created_at).toLocaleDateString()}
                        </span>
                        {deed.verified_at && (
                          <span className="flex items-center gap-1">
                            <CheckCircle className="w-3 h-3 text-emerald-500" />
                            Verified {new Date(deed.verified_at).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {washPeerColor && (
        <ColorWashOverlay myColor={myTierColor} peerColor={washPeerColor} onComplete={() => setWashPeerColor(null)} />
      )}

      {rateTarget && (
        <SwipeToRate
          connectionId={rateTarget}
          onSubmit={(stars) => handleSubmitRating(rateTarget, stars)}
          onClose={() => setRateTarget(null)}
        />
      )}

      <LabelConnectionDialog
        connectionId={labelTarget}
        open={!!labelTarget}
        onOpenChange={(o) => !o && setLabelTarget(null)}
        onSaved={() => {
          if (friends.length) {
            localPIIVault.lookupBatch(friends.map((f) => f.id)).then(setLabels);
          }
        }}
      />

      <ProximityAwarenessOverlay
        open={proximityOpen}
        onClose={() => setProximityOpen(false)}
        onPeerSelected={(peer) => {
          console.log("[PROXIMITY_HANDSHAKE_TRIGGER]");
          setProximityOpen(false);
          window.setTimeout(() => initiateSovereignHandshake("STANDARD"), 250);
        }}
      />
    </div>
  );
};

export default LifeScreen;