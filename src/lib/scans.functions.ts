import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function toBase64(bytes: Uint8Array) {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/** Runs the AI second opinion for a saved scan and stores the result on the scan row. */
export const runAiSecondOpinion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { scanId: string }) => {
    if (!input || typeof input.scanId !== "string" || input.scanId.length < 10) throw new Error("Invalid scan id");
    return { scanId: input.scanId };
  })
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: scan, error } = await supabase.from("scans").select("*").eq("id", data.scanId).single();
    if (error || !scan) throw new Error("Scan not found");
    if (scan.ai_status === "done") return scan;

    await supabase.from("scans").update({ ai_status: "running", ai_error: null }).eq("id", scan.id);

    const { data: blob, error: dlError } = await supabase.storage.from("xrays").download(scan.image_path);
    if (dlError || !blob) {
      const { data: failed } = await supabase
        .from("scans")
        .update({ ai_status: "failed", ai_error: "Could not read the stored X-ray image." })
        .eq("id", scan.id)
        .select("*")
        .single();
      return failed ?? scan;
    }
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const dataUrl = `data:${blob.type || "image/jpeg"};base64,${toBase64(bytes)}`;

    const { analyzeXrayWithAi, AiAnalysisError } = await import("@/lib/ai/xray-analysis.server");
    try {
      const ai = await analyzeXrayWithAi(dataUrl, { tbModelProbability: scan.tb_probability });
      const { data: updated, error: upError } = await supabase
        .from("scans")
        .update({
          ai_status: "done",
          ai_normal: ai.normal,
          ai_pneumonia: ai.pneumonia,
          ai_tb: ai.tuberculosis,
          ai_label: ai.is_chest_xray ? ai.label : "Not a chest X-ray",
          ai_findings: ai.findings,
          ai_impression: ai.impression,
          ai_image_quality: ai.image_quality,
          ai_error: null,
        })
        .eq("id", scan.id)
        .select("*")
        .single();
      if (upError || !updated) throw new Error("Could not save the AI result.");
      return updated;
    } catch (err) {
      const message =
        err instanceof AiAnalysisError ? err.message : err instanceof Error ? err.message : "AI analysis failed.";
      console.error("AI second opinion failed", err);
      const { data: failed } = await supabase
        .from("scans")
        .update({ ai_status: "failed", ai_error: message })
        .eq("id", scan.id)
        .select("*")
        .single();
      return failed ?? scan;
    }
  });
