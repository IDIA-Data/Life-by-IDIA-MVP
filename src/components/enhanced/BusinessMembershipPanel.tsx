import React, { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Building, Clock, LogOut, Upload, Check, ImagePlus } from "lucide-react";
import {
  useBusinessMembership,
  type Membership,
  type EntityType,
  type IntakePayload,
} from "@/hooks/useBusinessMembership";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { US_STATES } from "@/utils/usAddressValidation";

const roleBadgeVariant = (role: string): "default" | "secondary" | "outline" => {
  if (role === "Org Admin") return "default";
  if (role === "Team Lead") return "secondary";
  return "outline";
};

// IRS-published invalid EIN prefixes (campus codes never assigned)
const INVALID_EIN_PREFIXES = new Set([
  "00", "07", "08", "09", "17", "18", "19", "28", "29",
  "49", "69", "70", "78", "79", "89",
]);

const ENTITY_TYPES: EntityType[] = ["C-Corp", "S-Corp", "LLC", "Sole", "Non-Profit"];

interface DocSlot {
  key: string;
  label: string;
}

const docsForEntity = (e: EntityType | ""): DocSlot[] => {
  switch (e) {
    case "C-Corp":
    case "S-Corp":
      return [{ key: "articles_of_incorporation", label: "Articles of Incorporation" }];
    case "LLC":
      return [{ key: "articles_of_organization", label: "Articles of Organization" }];
    case "Non-Profit":
      return [
        { key: "articles_of_incorporation", label: "Articles of Incorporation" },
        { key: "irs_letter_of_determination", label: "IRS Letter of Determination" },
      ];
    case "Sole":
      return [{ key: "schedule_c_tax_return", label: "Schedule C Tax Return" }];
    default:
      return [];
  }
};

const formatEIN = (raw: string) => {
  const digits = raw.replace(/\D/g, "").slice(0, 9);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}-${digits.slice(2)}`;
};

const isValidEIN = (ein: string) => {
  if (!/^\d{2}-\d{7}$/.test(ein)) return false;
  return !INVALID_EIN_PREFIXES.has(ein.slice(0, 2));
};

const isValidZip = (zip: string) => /^\d{5}(-\d{4})?$/.test(zip);

// Verify the file is actually a PDF (magic bytes %PDF-)
const isPdfMagic = async (file: File) => {
  const buf = new Uint8Array(await file.slice(0, 5).arrayBuffer());
  const sig = String.fromCharCode(...buf);
  return sig === "%PDF-";
};

interface Vertical {
  id: string;
  name: string;
}
interface Submodule {
  id: string;
  vertical_id: string;
  name: string;
}

const BusinessMembershipPanel: React.FC = () => {
  const { loading, memberships, pendingRequest, submitIntake, leaveBusiness } =
    useBusinessMembership();
  const { toast } = useToast();

  const [showIntake, setShowIntake] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Taxonomy
  const [verticals, setVerticals] = useState<Vertical[]>([]);
  const [submodules, setSubmodules] = useState<Submodule[]>([]);
  const [taxLoading, setTaxLoading] = useState(false);

  // Form state
  const [companyName, setCompanyName] = useState("");
  const [ein, setEin] = useState("");
  const [entityType, setEntityType] = useState<EntityType | "">("");
  const [verticalId, setVerticalId] = useState("");
  const [submoduleId, setSubmoduleId] = useState("");
  const [street1, setStreet1] = useState("");
  const [street2, setStreet2] = useState("");
  const [city, setCity] = useState("");
  const [stateCode, setStateCode] = useState("");
  const [zip, setZip] = useState("");
  const [contactRole, setContactRole] = useState("Controlling Partner");
  const [docFiles, setDocFiles] = useState<Record<string, File>>({});
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  const [leaveTarget, setLeaveTarget] = useState<Membership | null>(null);
  const [leaving, setLeaving] = useState(false);

  // Load taxonomy when dialog opens
  useEffect(() => {
    if (!showIntake || verticals.length > 0) return;
    setTaxLoading(true);
    (async () => {
      const [v, s] = await Promise.all([
        supabase.from("taxonomy_verticals" as any).select("id, name").order("name"),
        supabase
          .from("taxonomy_submodules" as any)
          .select("id, vertical_id, name")
          .order("name"),
      ]);
      if (v.data) setVerticals(v.data as any);
      if (s.data) setSubmodules(s.data as any);
      setTaxLoading(false);
    })();
  }, [showIntake, verticals.length]);

  const filteredSubmodules = useMemo(
    () => submodules.filter((s) => s.vertical_id === verticalId),
    [submodules, verticalId],
  );

  const requiredDocs = useMemo(() => docsForEntity(entityType), [entityType]);

  const resetForm = () => {
    setCompanyName("");
    setEin("");
    setEntityType("");
    setVerticalId("");
    setSubmoduleId("");
    setStreet1("");
    setStreet2("");
    setCity("");
    setStateCode("");
    setZip("");
    setContactRole("Controlling Partner");
    setDocFiles({});
    setLogoFile(null);
    setLogoPreview(null);
  };

  const handleLogo = (file: File | undefined) => {
    if (!file) return;
    if (!["image/jpeg", "image/png"].includes(file.type)) {
      toast({ title: "Invalid logo", description: "JPG or PNG only.", variant: "destructive" });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Logo too large", description: "5 MB maximum.", variant: "destructive" });
      return;
    }
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  };

  if (loading) {
    return <div className="h-12 rounded-md bg-muted/50 animate-pulse" />;
  }

  const handleFile = async (slot: string, file: File | undefined) => {
    if (!file) return;
    if (file.type !== "application/pdf") {
      toast({ title: "PDF only", description: "Upload a PDF document.", variant: "destructive" });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "File too large", description: "10 MB maximum.", variant: "destructive" });
      return;
    }
    if (!(await isPdfMagic(file))) {
      toast({
        title: "Invalid PDF",
        description: "File contents are not a valid PDF.",
        variant: "destructive",
      });
      return;
    }
    setDocFiles((prev) => ({ ...prev, [slot]: file }));
  };

  const handleSubmit = async () => {
    // Validate
    if (!companyName.trim()) {
      toast({ title: "Missing", description: "Legal business name is required.", variant: "destructive" });
      return;
    }
    if (!isValidEIN(ein)) {
      toast({
        title: "Invalid EIN",
        description: "Use the format ##-####### with a valid IRS prefix.",
        variant: "destructive",
      });
      return;
    }
    if (!entityType) {
      toast({ title: "Missing", description: "Select a business type.", variant: "destructive" });
      return;
    }
    if (!verticalId || !submoduleId) {
      toast({ title: "Missing", description: "Select industry and sub-module.", variant: "destructive" });
      return;
    }
    if (!street1.trim() || !city.trim() || !stateCode || !isValidZip(zip)) {
      toast({ title: "Address", description: "Provide a complete US address.", variant: "destructive" });
      return;
    }
    for (const d of requiredDocs) {
      if (!docFiles[d.key]) {
        toast({
          title: "Document missing",
          description: `Upload: ${d.label}`,
          variant: "destructive",
        });
        return;
      }
    }

    setSubmitting(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("You must be signed in.");

      const requestId = (crypto as any).randomUUID();
      const documentPaths: string[] = [];

      // Upload PDFs to {uid}/{requestId}/{slot}.pdf
      for (const d of requiredDocs) {
        const file = docFiles[d.key];
        const path = `${user.id}/${requestId}/${d.key}.pdf`;
        const { error: upErr } = await supabase.storage
          .from("business-kyb-docs")
          .upload(path, file, { contentType: "application/pdf", upsert: false });
        if (upErr) throw upErr;
        documentPaths.push(path);
      }

      // Upload optional logo to public bucket {uid}/{requestId}.{ext}
      let logoPath: string | null = null;
      if (logoFile) {
        const ext = logoFile.type === "image/png" ? "png" : "jpg";
        const path = `${user.id}/${requestId}.${ext}`;
        const { error: logoErr } = await supabase.storage
          .from("business-logos")
          .upload(path, logoFile, { contentType: logoFile.type, upsert: true });
        if (logoErr) throw logoErr;
        logoPath = path;
      }

      const payload: IntakePayload = {
        requestId,
        companyName,
        ein,
        entityType: entityType as EntityType,
        verticalId,
        submoduleId,
        address: { street1, street2, city, state: stateCode, zip },
        contactRole,
        documentPaths,
        logoPath,
      };
      await submitIntake(payload);

      toast({
        title: "Application submitted",
        description: "Your business account application is awaiting KYB review.",
      });
      setShowIntake(false);
      resetForm();
    } catch (err: any) {
      toast({
        title: "Submission failed",
        description: err.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleLeave = async () => {
    if (!leaveTarget) return;
    setLeaving(true);
    try {
      await leaveBusiness(leaveTarget.employeeId);
      toast({
        title: "Left business",
        description: `You are no longer a member of ${leaveTarget.businessName}.`,
      });
      setLeaveTarget(null);
    } catch (err: any) {
      toast({
        title: "Could not leave",
        description: err.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setLeaving(false);
    }
  };

  // STATE A: memberships exist
  if (memberships.length > 0) {
    return (
      <TooltipProvider delayDuration={150}>
        <div className="divide-y divide-border rounded-md border">
          {memberships.map((m) => {
            const disabled = m.isLastOrgAdmin;
            const leaveBtn = (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-xs"
                disabled={disabled}
                onClick={() => setLeaveTarget(m)}
              >
                <LogOut className="w-3 h-3 mr-1" />
                Leave
              </Button>
            );
            return (
              <div
                key={m.employeeId}
                className="flex items-center justify-between gap-2 px-2.5 py-2"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{m.businessName}</p>
                  <Badge variant={roleBadgeVariant(m.platformRole)} className="text-[10px] mt-0.5">
                    {m.platformRole}
                  </Badge>
                </div>
                {disabled ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span tabIndex={0}>{leaveBtn}</span>
                    </TooltipTrigger>
                    <TooltipContent side="left" className="max-w-[220px] text-xs">
                      You are the last Org Admin. Closing the business is not allowed from IDIA
                      Life.
                    </TooltipContent>
                  </Tooltip>
                ) : (
                  leaveBtn
                )}
              </div>
            );
          })}
        </div>

        <AlertDialog open={!!leaveTarget} onOpenChange={(o) => !o && setLeaveTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Leave {leaveTarget?.businessName}?</AlertDialogTitle>
              <AlertDialogDescription>
                You will lose access to this business in IDIA Life. An Org Admin can re-invite you
                later.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={leaving}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleLeave} disabled={leaving}>
                {leaving ? "Leaving..." : "Leave"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </TooltipProvider>
    );
  }

  // STATE B: pending intake
  if (pendingRequest) {
    return (
      <div className="flex items-start gap-2 rounded-md border bg-muted/40 px-2.5 py-2">
        <Clock className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium truncate">{pendingRequest.company_name}</p>
          <p className="text-[11px] text-muted-foreground">
            {pendingRequest.entity_type ? `${pendingRequest.entity_type} — ` : ""}
            {pendingRequest.contact_role} — application awaiting KYB review.
          </p>
        </div>
        <Badge variant="secondary" className="text-[10px]">
          In review
        </Badge>
      </div>
    );
  }

  // STATE C: no memberships, no pending request
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
      <p className="text-xs text-muted-foreground">
        Run a business? Apply for a business account. KYB review happens in the IDIA Hub app.
      </p>
      <Dialog open={showIntake} onOpenChange={setShowIntake}>
        <DialogTrigger asChild>
          <Button size="sm">
            <Building className="w-4 h-4 mr-2" />
            Apply for Business Account
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-md p-0 overflow-hidden max-h-[92vh] flex flex-col">
          <DialogHeader className="px-4 pt-3 pb-1 shrink-0">
            <DialogTitle className="text-base text-center">Business Application</DialogTitle>
            <DialogDescription className="sr-only">
              Intake only. KYB review happens in the IDIA Hub app.
            </DialogDescription>
          </DialogHeader>

          {/* Logo upload — top center */}
          <div className="flex justify-center pt-1 pb-2 shrink-0">
            <label
              htmlFor="business-logo-upload"
              className="relative w-16 h-16 rounded-full border-2 border-dashed border-border bg-muted/40 hover:bg-muted cursor-pointer flex items-center justify-center overflow-hidden transition-colors"
              title="Upload logo (JPG or PNG)"
            >
              {logoPreview ? (
                <img src={logoPreview} alt="Logo preview" className="w-full h-full object-cover" />
              ) : (
                <ImagePlus className="w-5 h-5 text-muted-foreground" />
              )}
              <input
                id="business-logo-upload"
                type="file"
                accept="image/jpeg,image/png"
                className="sr-only"
                onChange={(e) => handleLogo(e.target.files?.[0])}
              />
            </label>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar px-4 pb-3 space-y-2">
            <Input
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Legal business name"
              className="h-9"
            />

            <div className="grid grid-cols-2 gap-2">
              <Input
                value={ein}
                onChange={(e) => setEin(formatEIN(e.target.value))}
                placeholder="EIN ##-#######"
                inputMode="numeric"
                className="h-9"
              />
              <Select value={entityType} onValueChange={(v) => setEntityType(v as EntityType)}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Type" /></SelectTrigger>
                <SelectContent>
                  {ENTITY_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Select
                value={verticalId}
                onValueChange={(v) => { setVerticalId(v); setSubmoduleId(""); }}
                disabled={taxLoading}
              >
                <SelectTrigger className="h-9"><SelectValue placeholder={taxLoading ? "..." : "Industry"} /></SelectTrigger>
                <SelectContent>
                  {verticals.map((v) => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select
                value={submoduleId}
                onValueChange={setSubmoduleId}
                disabled={!verticalId || filteredSubmodules.length === 0}
              >
                <SelectTrigger className="h-9"><SelectValue placeholder="Sub-module" /></SelectTrigger>
                <SelectContent>
                  {filteredSubmodules.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <Input
              value={street1}
              onChange={(e) => setStreet1(e.target.value)}
              placeholder="Street address"
              className="h-9"
            />

            <div className="grid grid-cols-6 gap-2">
              <Input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="City"
                className="h-9 col-span-3"
              />
              <Select value={stateCode} onValueChange={setStateCode}>
                <SelectTrigger className="h-9 col-span-1 px-2"><SelectValue placeholder="ST" /></SelectTrigger>
                <SelectContent>
                  {US_STATES.map((s) => <SelectItem key={s.code} value={s.code}>{s.code}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input
                value={zip}
                onChange={(e) => setZip(e.target.value)}
                placeholder="ZIP"
                inputMode="numeric"
                className="h-9 col-span-2"
              />
            </div>

            <Select value={contactRole} onValueChange={setContactRole}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Controlling Partner">Controlling Partner</SelectItem>
                <SelectItem value="Authorized Signatory">Authorized Signatory</SelectItem>
              </SelectContent>
            </Select>

            {requiredDocs.length > 0 && (
              <div className="space-y-1.5 pt-1">
                {requiredDocs.map((d) => {
                  const file = docFiles[d.key];
                  return (
                    <div key={d.key} className="flex items-center gap-2">
                      <Label className="text-[11px] text-muted-foreground w-1/2 truncate">{d.label}</Label>
                      <div className="flex items-center gap-1 flex-1 min-w-0">
                        <Input
                          type="file"
                          accept="application/pdf"
                          onChange={(e) => handleFile(d.key, e.target.files?.[0])}
                          className="text-xs h-8"
                        />
                        {file && <Check className="w-4 h-4 text-primary shrink-0" />}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="px-4 pb-3 pt-2 border-t shrink-0">
            <Button className="w-full h-9" onClick={handleSubmit} disabled={submitting}>
              {submitting ? "Submitting..." : (<><Upload className="w-4 h-4 mr-2" />Submit Application</>)}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BusinessMembershipPanel;
