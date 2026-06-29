import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { governanceService } from "@/services/governanceService";
import { toast } from "@/hooks/use-toast";
import { walletService } from "@/services/walletService";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

// TEMP: testing — AI validation gate bypassed entirely.
const TEMP_DISABLE_AI_VALIDATION = false;

const CATEGORIES: { value: string; label: string }[] = [
  { value: "data-policy", label: "Data Policy" },
  { value: "rewards", label: "Rewards & Incentives" },
  { value: "platform", label: "Platform Features" },
  { value: "governance", label: "Governance" },
  { value: "security", label: "Security & Privacy" },
  { value: "other", label: "Other" },
];

const IMPACTS = ["Low", "Medium", "High"] as const;

export const CreateDaoProposalModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [impact, setImpact] = useState<string>("Medium");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setCategory("");
    setImpact("Medium");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // TEMP: testing — balance + required-field gates disabled. Fill defaults so DB NOT NULL holds.
    const safeTitle = title.trim() || "(untitled)";
    const safeDescription = description.trim() || "(no description)";

    setIsSubmitting(true);
    console.log("[PROPOSAL_SUBMIT] FLOW_START: Sovereign initiated proposal submission.");

    // ── On-chain mandate: wallet must be connected before anything else ──
    const signer = walletService.getConnectedSigner();
    if (!signer) {
      toast({
        title: "Wallet required",
        description:
          "Connect your sovereign wallet before submitting. Every proposal must anchor on-chain — no exceptions.",
        variant: "destructive",
      });
      setIsSubmitting(false);
      return;
    }

    try {
      console.log("[PROPOSAL_SUBMIT] AUTH_START: Resolving sovereign identity...");
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Authentication required.");
      console.log("[PROPOSAL_SUBMIT] AUTH_SUCCESS: User resolved.");

      // Pre-mint the DB UUID so the on-chain description carries a deterministic
      // salt (System Ref). This guarantees a unique descriptionHash on every
      // submit — even when title+description are byte-identical to a prior
      // proposal — and gives us a 1:1 lineage between the on-chain proposal
      // and the dao_proposals row.
      const proposalUuid =
        (typeof crypto !== "undefined" && "randomUUID" in crypto)
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const saltedDescription = `# ${safeTitle}\n\n${safeDescription}\n\n---\n*System Ref: ${proposalUuid}*`;

      // ─── ON-CHAIN EXECUTION BLOCK (MANDATORY) ──────────────────────────
      console.log("[PROPOSAL_SUBMIT] CHAIN_START: Requesting wallet signature (uuid=" + proposalUuid + ")…");

      let chainResult: { hash: string; proposalId?: string };
      try {
        console.log("[PROPOSAL_SUBMIT][MODAL_DISPATCH][START] Forwarding sanitized payload to governance service.");
        chainResult = await governanceService.propose(saltedDescription);
        console.log("[PROPOSAL_SUBMIT][MODAL_DISPATCH][SUCCESS] Governance service returned chain receipt.", {
          hash: chainResult.hash,
          proposalId: chainResult.proposalId,
        });
      } catch (chainErr: any) {
        console.error("[PROPOSAL_SUBMIT][MODAL_DISPATCH][FATAL_FAIL]", chainErr?.message ?? chainErr);
        const code = chainErr?.code;
        let friendly = chainErr?.shortMessage || chainErr?.message || "Unknown chain error.";
        if (code === "ACTION_REJECTED" || code === 4001 || /user rejected/i.test(friendly)) {
          friendly = "Signature declined — proposal not submitted.";
        } else if (code === "INSUFFICIENT_FUNDS" || /insufficient funds/i.test(friendly)) {
          friendly = "Not enough gas to anchor the proposal on-chain.";
        } else if (code === "NETWORK_ERROR" || /network|timeout|fetch/i.test(friendly)) {
          friendly = "Could not reach the Governor contract. Try again in a moment.";
        } else if (/GovernorUnexpectedProposalState|already exists|duplicate/i.test(friendly)) {
          friendly = "An identical proposal is already on-chain. Refresh and try again.";
        }
        toast({
          title: "Proposal rejected — chain anchor failed",
          description: friendly,
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }


      const txHash = chainResult.hash;
      const onChainProposalId = chainResult.proposalId || "";

      // Hard gate: both txHash AND on-chain id required, otherwise no DB write.
      if (!txHash || !onChainProposalId) {
        console.error("[PROPOSAL_SUBMIT] CHAIN_MISSING_ID:", { txHash, onChainProposalId });
        toast({
          title: "Proposal rejected — chain anchor failed",
          description: "Governor did not confirm the proposal id. Please retry.",
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }
      console.log(`[PROPOSAL_SUBMIT] CHAIN_SUCCESS: Tx Hash: ${txHash} · id: ${onChainProposalId}`);

      let onChainBlock = null;
      try {
        console.log("[PROPOSAL_SUBMIT] RECEIPT_START: Awaiting block confirmation...");
        const provider = signer.provider;
        if (provider) {
          const receipt = await provider.getTransactionReceipt(txHash);
          onChainBlock = receipt?.blockNumber || null;
        }
        console.log(`[PROPOSAL_SUBMIT] RECEIPT_SUCCESS: Confirmed in block ${onChainBlock}`);
      } catch (receiptErr) {
        console.warn("[PROPOSAL_SUBMIT] RECEIPT_WARN: Block fetch stalled, proceeding.", receiptErr);
      }
      // ───────────────────────────────────────────────────────────────────────

      console.log("[PROPOSAL_SUBMIT] DB_INSERT_START: Committing active proposal...");
      const { data: inserted, error: insertError } = await (supabase as any)
        .from("dao_proposals")
        .insert({
          id: proposalUuid,
          proposer_id: user.id,
          title: safeTitle,
          description: safeDescription,
          status: "active",
          vote_type: "simple",
          voting_modality: "simple",
          lifecycle_phase: "active",
          on_chain_id: onChainProposalId,
          tx_hash: txHash,
          on_chain_block: onChainBlock,
        })
        .select()
        .single();
      if (insertError) {
        console.error("[PROPOSAL_SUBMIT] DB_INSERT_FAIL: Supabase rejection.", insertError);
        throw insertError;
      }
      console.log("[PROPOSAL_SUBMIT] DB_INSERT_SUCCESS: Row committed safely.", inserted?.id);

      if (TEMP_DISABLE_AI_VALIDATION) {
        console.log("[PROPOSAL_SUBMIT] VALIDATION_SKIPPED: Testing mode bypass active.");
      } else if (inserted?.id) {
        try {
          console.log("[PROPOSAL_SUBMIT] VALIDATION_INVOKE: calling validate-proposal");
          const { error: vErr } = await supabase.functions.invoke("validate-proposal", {
            body: {
              proposalId: inserted.id,
              title: safeTitle,
              description: safeDescription,
              category: "governance",
            },
          });
          if (vErr) console.warn("[PROPOSAL_SUBMIT] VALIDATION_WARN", vErr.message);
        } catch (vErr: any) {
          console.warn("[PROPOSAL_SUBMIT] VALIDATION_WARN_CATCH", vErr?.message);
        }
      }

      toast({
        title: "Proposal live on-chain!",
        description: "Successfully broadcasted to the IDIA Governor.",
      });

      resetForm();
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error("[PROPOSAL_SUBMIT] FLOW_ERROR:", err);
      toast({
        title: "Submission failed",
        description: err?.message ?? "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
      console.log("[PROPOSAL_SUBMIT] FLOW_END.");
    }
  };

  // TEMP: testing — only block while submitting
  const submitDisabled = isSubmitting;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !isSubmitting && onClose()}>
      <DialogContent className="sm:max-w-md rounded-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground font-black">
            <Send className="w-5 h-5 text-[hsl(178,42%,32%)] dark:text-teal-300" />
            Submit a Governance Proposal
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Shape the protocol. Testing mode routes submissions directly into Active Proposals.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label htmlFor="prop-title" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              Title
            </Label>
            <Input
              id="prop-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter proposal title"
              maxLength={100}
              disabled={isSubmitting}
              className="bg-muted/40 border-input text-foreground placeholder:text-muted-foreground"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                Category
              </Label>
              <Select value={category} onValueChange={setCategory} disabled={isSubmitting}>
                <SelectTrigger className="bg-muted/40 border-input text-foreground">
                  <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                Expected Impact
              </Label>
              <Select value={impact} onValueChange={setImpact} disabled={isSubmitting}>
                <SelectTrigger className="bg-muted/40 border-input text-foreground">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {IMPACTS.map((i) => (
                    <SelectItem key={i} value={i}>
                      {i} Impact
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="prop-desc" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              Description
            </Label>
            <Textarea
              id="prop-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe your proposal in detail..."
              maxLength={1000}
              rows={6}
              disabled={isSubmitting}
              className="bg-muted/40 border-input text-foreground placeholder:text-muted-foreground resize-none"
            />
            <p className="text-[10px] text-muted-foreground text-right">
              {description.length}/1000
            </p>
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 h-11 rounded-xl"
            >
              Cancel
            </Button>
            <span className="w-full block flex-1">
              <Button
                type="submit"
                disabled={submitDisabled}
                className="w-full h-11 bg-[hsl(178,42%,32%)] hover:bg-[hsl(178,42%,25%)] text-white font-black uppercase tracking-widest rounded-xl"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" /> Submitting...
                  </>
                ) : (
                  "Submit Proposal"
                )}
              </Button>
            </span>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CreateDaoProposalModal;
