import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type Scan = Tables<"scans">;
export type Finding = { region: string; observation: string; severity: "none" | "mild" | "moderate" | "severe" };

export const BUCKET = "xrays";

export const scansQueryOptions = () =>
  queryOptions({
    queryKey: ["scans"],
    queryFn: async () => {
      const { data, error } = await supabase.from("scans").select("*").order("created_at", { ascending: false }).limit(200);
      if (error) throw error;
      return data;
    },
  });

export const scanQueryOptions = (id: string) =>
  queryOptions({
    queryKey: ["scans", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("scans").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

export const signedUrlsQueryOptions = (paths: string[]) =>
  queryOptions({
    queryKey: ["signed-urls", ...paths],
    enabled: paths.length > 0,
    staleTime: 50 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(paths, 3600);
      if (error) throw error;
      const map: Record<string, string> = {};
      data.forEach((d) => {
        if (d.path && d.signedUrl) map[d.path] = d.signedUrl;
      });
      return map;
    },
  });

export async function deleteScan(scan: Scan) {
  const paths = [scan.image_path, scan.heatmap_path].filter(Boolean) as string[];
  if (paths.length) await supabase.storage.from(BUCKET).remove(paths);
  const { error } = await supabase.from("scans").delete().eq("id", scan.id);
  if (error) throw error;
}

export function findingsOf(scan: Scan): Finding[] {
  return Array.isArray(scan.ai_findings) ? (scan.ai_findings as unknown as Finding[]) : [];
}

export const pct = (v: number | null | undefined) => (v == null ? "—" : `${(v * 100).toFixed(1)}%`);
