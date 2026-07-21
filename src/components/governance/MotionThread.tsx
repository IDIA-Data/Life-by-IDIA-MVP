import React, { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, MessageSquare, ThumbsUp, ThumbsDown, Rocket, ChevronLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { generateACAHash } from "@/utils/acaGenerator";
import { recordACA } from "@/utils/acaLedger";
import { toast } from "@/hooks/use-toast";
import { getAscensionLevel } from "@/utils/governanceGate";
import { governanceService } from "@/services/governanceService";
import { walletService } from "@/services/walletService";

interface MotionThreadProps {
  proposal: {
    id: string;
    title: string;
    committee_id: string | null;
    lifecycle_phase: string | null;
    committee_quorum_required?: number | null;
  } | null;
  open: boolean;
  onClose: () => void;
  onChanged?: () => void;
}

interface Comment {
  id: string;
  author_id: string;
  body: string;
  created_at: string;
  profiles?: { wallet_address: string }; 
}

interface Signature {
  id: string;
  signer_id: string;
  signature_type: "endorse" | "object";
  created_at: string;
}

const MotionThread: React.FC<MotionThreadProps> = ({ proposal, open, onClose, onChanged }) => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [signatures, setSignatures] = useState<Signature[]>([]);
  const [newComment, setNewComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [level, setLevel] = useState(0);
  const [hasHat, setHasHat] = useState(false);

  useEffect(() => {
    if (!open || !proposal) return;
    void hydrate();
    const t = setInterval(hydrate, 8000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, proposal?.id]);

  const hydrate = async () => {
    console.log("[MOTION_THREAD][HYDRATE][START] Initiating data hydration sequence.");
    if (!proposal) return;
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.log("[MOTION_THREAD][HYDRATE][SKIP] No authenticated user found.");
        return;
      }
      setUserId(user.id);

      console.log("[MOTION_THREAD][HYDRATE][FETCH_CORE][START] Requesting hats, comments, and signatures.");
      // Decoupled fetch: No strict inline join to prevent foreign key crash
      const [hatsRes, commentsRes, sigsRes] = await Promise.all([
        (supabase as any).from("dao_hats").select("hat_type").eq("user_id", user.id)
          .eq("eligibility_status", "active").is("revoked_at", null),
        (supabase as any).from("proposal_comments").select("id, author_id, body, created_at")
          .eq("proposal_id", proposal.id).order("created_at", { ascending: true }),
        (supabase as any).from("proposal_signatures").select("id, signer_id, signature_type, created_at")
          .eq("proposal_id", proposal.id),
      ]);
      console.log("[MOTION_THREAD][HYDRATE][FETCH_CORE][END:OK] Core telemetry retrieved.");

      const rawComments = commentsRes.data || [];
      let enrichedComments = rawComments;
      
      if (rawComments.length > 0) {
        console.log("[MOTION_THREAD][HYDRATE][FETCH_PROFILES][START] Resolving wallet addresses for authors.");
        const uniqueAuthorIds = [...new Set(rawComments.map((c: any) => c.author_id))];
        
        const { data: profilesData, error: profileError } = await (supabase as any)
          .from("profiles")
          .select("id, wallet_address")
          .in("id", uniqueAuthorIds);

        if (profileError) {
          console.error(`[MOTION_THREAD][HYDRATE][FETCH_PROFILES][ERROR] Address resolution failed: ${profileError.message}`);
        }

        const profileMap = new Map((profilesData || []).map((p: any) => [p.id, p]));
        enrichedComments = rawComments.map((c: any) => ({
          ...c,
          profiles: profileMap.get(c.author_id) || null
        }));
        console.log("[MOTION_THREAD][HYDRATE][FETCH_PROFILES][END:OK] Addresses stitched to comments.");
      }

      const hatSet = new Set<string>((hatsRes.data || []).map((h: any) => h.hat_type));
      setLevel(getAscensionLevel(hatSet));
      // L3 Tophat is a universal committee override — matches CommitteeRosterModal's honorary-L3 display.
      setHasHat(
        hatSet.has("tophat") ||
        (proposal.committee_id ? hatSet.has(proposal.committee_id) : false)
      );
      
      setComments(enrichedComments);
      setSignatures(sigsRes.data || []);
      console.log("[MOTION_THREAD][HYDRATE][END:OK] Component state successfully bound.");
    } catch (err: any) {
      console.error(`[MOTION_THREAD][HYDRATE][FATAL_FAIL] Hydration collapsed. Reason: ${err.message}`);
    }
  };

  const postComment = async () => {
    console.log("[MOTION_THREAD][POST_COMMENT][START] Executing comment payload.");
    if (!proposal || !userId || newComment.trim().length < 2) return;
    setBusy(true);
    try {
      console.log("[MOTION_THREAD][POST_COMMENT][ACA][START] Generating cryptographic intent.");
      const { hash, payload } = await generateACAHash(userId, `motion_comment_${proposal.id}`, [
        "MOTION_COMMENT", "DELIBERATION",
      ]);
      console.log("[MOTION_THREAD][POST_COMMENT][ACA][END:OK] Hash generated.");

      const { error } = await (supabase as any).from("proposal_comments").insert({
        proposal_id: proposal.id,
        author_id: userId,
        body: newComment.trim(),
        aca_hash_key: hash,
      });
      if (error) throw error;
      
      await recordACA({ userId, sourceId: "GOV_MOTION_COMMENT", consentType: "MOTION_COMMENT_V1", hash, payload });
      setNewComment("");
      void hydrate();
      console.log("[MOTION_THREAD][POST_COMMENT][END:OK] Comment securely committed.");
    } catch (e: any) {
      console.error(`[MOTION_THREAD][POST_COMMENT][FATAL_FAIL] Execution reverted. Reason: ${e.message}`);
      toast({ title: "Comment failed", description: e.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const sign = async (signature_type: "endorse" | "object") => {
    console.log(`[MOTION_THREAD][SIGN][START] Executing ${signature_type.toUpperCase()} protocol.`);
    if (!proposal || !userId) return;
    setBusy(true);
    try {
      const { hash, payload } = await generateACAHash(userId, `motion_sign_${signature_type}_${proposal.id}`, [
        "MOTION_SIGN", signature_type === "endorse" ? "ENDORSE" : "OBJECT",
      ]);
      const { error } = await (supabase as any).from("proposal_signatures").insert({
        proposal_id: proposal.id,
        signer_id: userId,
        signature_type,
        aca_hash_key: hash,
      });
      if (error) throw error;
      
      await recordACA({ userId, sourceId: "GOV_MOTION_SIGN", consentType: `MOTION_${signature_type.toUpperCase()}_V1`, hash, payload });
      toast({ title: signature_type === "endorse" ? "Endorsement recorded" : "Objection recorded" });
      void hydrate();
      console.log(`[MOTION_THREAD][SIGN][END:OK] ${signature_type.toUpperCase()} firmly recorded.`);
    } catch (e: any) {
      console.error(`[MOTION_THREAD][SIGN][FATAL_FAIL] Signature rejected. Reason: ${e.message}`);
      toast({ title: "Signature failed", description: e.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const escalate = async () => {
    console.log("[MOTION_THREAD][ESCALATE][START] Initiating DAO floor escalation.");
    if (!proposal || !userId) return;

    // ── On-chain mandate: wallet must be connected before anchoring ──
    const signer = walletService.getConnectedSigner();
    if (!signer) {
      toast({
        title: "Wallet required",
        description: "Connect your sovereign wallet to anchor this motion on the Governor.",
        variant: "destructive",
      });
      return;
    }

    setBusy(true);
    try {
      // Fetch the full motion body so the on-chain description carries context.
      const { data: motionRow } = await (supabase as any)
        .from("dao_proposals")
        .select("title, description")
        .eq("id", proposal.id)
        .maybeSingle();
      const motionTitle = motionRow?.title || proposal.title || "(untitled motion)";
      const motionBody = motionRow?.description || "(no body)";
      const saltedDescription = `# ${motionTitle}\n\n${motionBody}\n\n---\n*System Ref: ${proposal.id}*`;

      console.log("[MOTION_THREAD][ESCALATE][CHAIN_START] Requesting wallet signature for Governor.propose()…");
      let chainResult: { hash: string; proposalId?: string };
      try {
        chainResult = await governanceService.propose(saltedDescription);
      } catch (chainErr: any) {
        const code = chainErr?.code;
        let friendly = chainErr?.shortMessage || chainErr?.message || "Unknown chain error.";
        if (code === "ACTION_REJECTED" || code === 4001 || /user rejected/i.test(friendly)) {
          friendly = "Signature declined — motion not escalated.";
        } else if (code === "INSUFFICIENT_FUNDS" || /insufficient funds/i.test(friendly)) {
          friendly = "Not enough gas to anchor this motion on-chain.";
        } else if (/GovernorUnexpectedProposalState|already exists|duplicate/i.test(friendly)) {
          friendly = "An identical proposal is already on-chain.";
        }
        throw new Error(friendly);
      }

      const txHash = chainResult.hash;
      const onChainId = chainResult.proposalId || "";
      if (!txHash || !onChainId) {
        throw new Error("Governor did not confirm the proposal id. Please retry.");
      }

      let onChainBlock: number | null = null;
      try {
        const provider = signer.provider;
        if (provider) {
          const receipt = await provider.getTransactionReceipt(txHash);
          onChainBlock = receipt?.blockNumber ?? null;
        }
      } catch {
        // Block fetch is best-effort — the server still records the id.
      }

      const { hash, payload } = await generateACAHash(userId, `motion_escalate_${proposal.id}`, [
        "MOTION_ESCALATE", "LEDGER_WRITE",
      ]);
      const { data, error } = await supabase.functions.invoke("gov-escalate-motion", {
        body: {
          proposal_id: proposal.id,
          aca_hash: hash,
          aca_payload: payload,
          on_chain_id: onChainId,
          tx_hash: txHash,
          on_chain_block: onChainBlock,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);

      toast({ title: "Motion escalated · live on Governor" });
      onChanged?.();
      onClose();
      console.log("[MOTION_THREAD][ESCALATE][END:OK] Payload escalated successfully.");
    } catch (e: any) {
      console.error(`[MOTION_THREAD][ESCALATE][FATAL_FAIL] Escalation dropped. Reason: ${e.message}`);
      toast({ title: "Escalate failed", description: e.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const formatAddress = (c: Comment) => {
    const addr = c.profiles?.wallet_address || c.author_id;
    if (addr.startsWith("0x") && addr.length === 42) {
      return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
    }
    return addr;
  };

  const endorseCount = signatures.filter((s) => s.signature_type === "endorse").length;
  const objectCount = signatures.filter((s) => s.signature_type === "object").length;
  const required = proposal?.committee_quorum_required ?? 3;
  const canEscalate = level >= 2 && proposal?.lifecycle_phase === "draft" && endorseCount >= required;
  const mySig = signatures.find((s) => s.signer_id === userId);

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent 
        side="right" 
        className="w-full sm:max-w-md overflow-y-auto pt-[max(env(safe-area-inset-top),3rem)] pb-[max(env(safe-area-inset-bottom),2rem)]"
      >
        <SheetHeader>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="icon" className="h-8 w-8 shrink-0" onClick={onClose}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <SheetTitle className="text-sm font-black uppercase tracking-wider text-left">
              {proposal?.title || "Motion"}
            </SheetTitle>
          </div>
          
          <div className="flex items-center gap-2 flex-wrap pt-2">
            <Badge variant="outline" className="text-[9px] uppercase tracking-widest">
              {proposal?.lifecycle_phase || "—"}
            </Badge>
            <Badge className="bg-teal-600 text-white text-[9px] uppercase tracking-widest">
              {endorseCount}/{required} endorse
            </Badge>
            {objectCount > 0 && (
              <Badge className="bg-rose-500 text-white text-[9px] uppercase tracking-widest">
                {objectCount} object
              </Badge>
            )}
          </div>
        </SheetHeader>

        <section className="mt-6 space-y-3">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Committee Quorum</h3>
          <div className="grid grid-cols-2 gap-2">
            <Button
              onClick={() => sign("endorse")}
              disabled={busy || !hasHat || !!mySig}
              className="bg-teal-700 hover:bg-teal-800 text-white text-[10px] font-black uppercase tracking-wider"
            >
              <ThumbsUp className="w-3.5 h-3.5 mr-1.5" />
              {mySig?.signature_type === "endorse" ? "Endorsed" : "Endorse"}
            </Button>
            <Button
              onClick={() => sign("object")}
              disabled={busy || !hasHat || !!mySig}
              variant="outline"
              className="border-rose-300 text-rose-700 hover:bg-rose-50 text-[10px] font-black uppercase tracking-wider"
            >
              <ThumbsDown className="w-3.5 h-3.5 mr-1.5" />
              {mySig?.signature_type === "object" ? "Objected" : "Object"}
            </Button>
          </div>
          {!hasHat && (
            <p className="text-[10px] text-muted-foreground">
              Only active officers of this committee may sign.
            </p>
          )}
          {canEscalate && (
            <Button
              onClick={escalate}
              disabled={busy}
              className="w-full bg-orange-600 hover:bg-orange-700 text-white text-[10px] font-black uppercase tracking-widest"
            >
              {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Rocket className="w-3.5 h-3.5 mr-1.5" />}
              Bring to the Floor
            </Button>
          )}
        </section>

        <section className="mt-6 space-y-3">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
            <MessageSquare className="w-3 h-3" /> Deliberation ({comments.length})
          </h3>
          <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-2">
            {comments.length === 0 ? (
              <p className="text-[10px] text-muted-foreground italic">No comments yet.</p>
            ) : (
              comments.map((c) => (
                <div key={c.id} className="rounded-2xl border border-border bg-card/50 p-3 space-y-1">
                  <p className="text-[9px] font-mono text-muted-foreground truncate">{formatAddress(c)}</p>
                  <p className="text-xs whitespace-pre-wrap">{c.body}</p>
                  <p className="text-[9px] text-muted-foreground">{new Date(c.created_at).toLocaleString()}</p>
                </div>
              ))
            )}
          </div>
          <Textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Add to the deliberation…"
            className="text-xs min-h-[80px] rounded-2xl"
            disabled={busy}
          />
          <Button onClick={postComment} disabled={busy || newComment.trim().length < 2} className="w-full">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Post Comment"}
          </Button>
        </section>
      </SheetContent>
    </Sheet>
  );
};

export default MotionThread;