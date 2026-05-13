import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type PlatformRole = "Org Admin" | "Team Lead" | "Team Member" | string;
export type EntityType = "C-Corp" | "S-Corp" | "LLC" | "Sole" | "Non-Profit";

export interface Membership {
  employeeId: string;
  businessId: string;
  businessName: string;
  platformRole: PlatformRole;
  isLastOrgAdmin: boolean;
}

export interface ConversionRequest {
  id: string;
  company_name: string;
  contact_role: string;
  entity_type: string | null;
  status: string | null;
  created_at: string | null;
}

export interface IntakePayload {
  requestId: string; // pre-generated UUID; storage paths are bound to it
  companyName: string;
  ein: string;
  entityType: EntityType;
  verticalId: string;
  submoduleId: string;
  address: {
    street1: string;
    street2?: string;
    city: string;
    state: string;
    zip: string;
  };
  contactRole: string;
  documentPaths: string[];
  logoPath?: string | null;
}

interface State {
  loading: boolean;
  memberships: Membership[];
  pendingRequest: ConversionRequest | null;
}

const PENDING_STATUSES = new Set(["pending", "in_review", "received", "review"]);

/**
 * Reads business memberships and intake-application status for the current user.
 *
 * IDIA Life is intake-only for business accounts. We never create a business or
 * assign Org Admin from this app — the Hub app does that after KYB.
 *
 * Identity is bound exclusively to the user's GUID (auth.uid()). No PII is
 * stored in the public schema by this flow.
 */
export const useBusinessMembership = () => {
  const [state, setState] = useState<State>({
    loading: true,
    memberships: [],
    pendingRequest: null,
  });

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true }));
    console.log("[BUSINESS_MEMBERSHIP_LOAD_START]");

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setState({ loading: false, memberships: [], pendingRequest: null });
      return;
    }

    const { data: empRows, error: empErr } = await supabase
      .from("employees")
      .select("id, business_id, platform_role, status, businesses:business_id ( name )")
      .eq("user_id", user.id)
      .eq("status", "active");

    if (empErr) console.error("[BUSINESS_MEMBERSHIP] employees error", empErr);

    const baseMemberships: Membership[] = (empRows || []).map((row: any) => ({
      employeeId: row.id,
      businessId: row.business_id,
      businessName: row.businesses?.name || "Unnamed Business",
      platformRole: row.platform_role || "Team Member",
      isLastOrgAdmin: false,
    }));

    const memberships = await Promise.all(
      baseMemberships.map(async (m) => {
        if (m.platformRole !== "Org Admin") return m;
        const { count, error } = await supabase
          .from("employees")
          .select("id", { count: "exact", head: true })
          .eq("business_id", m.businessId)
          .eq("platform_role", "Org Admin")
          .eq("status", "active")
          .neq("id", m.employeeId);
        if (error) console.error("[BUSINESS_MEMBERSHIP] admin count error", error);
        return { ...m, isLastOrgAdmin: (count || 0) === 0 };
      }),
    );

    const { data: reqRows, error: reqErr } = await supabase
      .from("account_conversion_requests")
      .select("id, company_name, contact_role, entity_type, status, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1);

    if (reqErr) console.error("[BUSINESS_MEMBERSHIP] requests error", reqErr);

    const latest = (reqRows || [])[0] as ConversionRequest | undefined;
    const pendingRequest =
      latest && PENDING_STATUSES.has((latest.status || "pending").toLowerCase()) ? latest : null;

    setState({ loading: false, memberships, pendingRequest });
    console.log("[BUSINESS_MEMBERSHIP_LOAD_END]", {
      memberships: memberships.length,
      hasPending: !!pendingRequest,
    });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const submitIntake = useCallback(
    async (payload: IntakePayload) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("You must be signed in to apply.");

      const { error } = await supabase.from("account_conversion_requests").insert({
        id: payload.requestId,
        user_id: user.id, // GUID is the sole identity anchor
        company_name: payload.companyName.trim(),
        ein: payload.ein,
        entity_type: payload.entityType,
        vertical_id: payload.verticalId,
        submodule_id: payload.submoduleId,
        address_street1: payload.address.street1.trim(),
        address_street2: payload.address.street2?.trim() || null,
        address_city: payload.address.city.trim(),
        address_state: payload.address.state,
        address_zip: payload.address.zip.trim(),
        contact_role: payload.contactRole,
        document_paths: payload.documentPaths,
        logo_path: payload.logoPath ?? null,
        request_type: "Personal to Business",
        status: "pending",
      } as any);
      if (error) throw error;
      await load();
    },
    [load],
  );

  const leaveBusiness = useCallback(
    async (employeeId: string) => {
      const { error } = await supabase.rpc(
        "revoke_employee" as any,
        { _employee_id: employeeId } as any,
      );
      if (error) {
        if ((error.message || "").includes("LAST_ORG_ADMIN_DELETE_ORG")) {
          throw new Error(
            "You are the last Org Admin. Closing the business is not allowed from IDIA Life.",
          );
        }
        throw error;
      }
      await load();
    },
    [load],
  );

  return {
    ...state,
    refresh: load,
    submitIntake,
    leaveBusiness,
  };
};
