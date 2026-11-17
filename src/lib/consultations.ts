import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type Consultation = Tables<"consultations">;

export const consultationsQueryOptions = () =>
  queryOptions({
    queryKey: ["consultations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("consultations")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data;
    },
  });

export const consultationQueryOptions = (id: string) =>
  queryOptions({
    queryKey: ["consultations", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("consultations").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

export const scanConsultationsQueryOptions = (scanId: string) =>
  queryOptions({
    queryKey: ["consultations", "scan", scanId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("consultations")
        .select("*")
        .eq("scan_id", scanId)
        .neq("status", "cancelled")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

export const statusLabel: Record<string, string> = {
  pending_payment: "Awaiting payment",
  confirmed: "Confirmed",
  cancelled: "Cancelled",
};

export const statusTone: Record<string, string> = {
  pending_payment: "border-pneumonia/40 bg-pneumonia/10 text-pneumonia",
  confirmed: "border-normal/40 bg-normal/10 text-normal",
  cancelled: "border-border bg-secondary text-muted-foreground",
};
