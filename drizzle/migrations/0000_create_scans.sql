CREATE TABLE public.scans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  patient_ref text,
  notes text,
  file_name text NOT NULL,
  file_type text NOT NULL,
  image_path text NOT NULL,
  heatmap_path text,
  model_version text NOT NULL DEFAULT 'resnet18-tb-v1',
  tb_probability real NOT NULL,
  tb_label text NOT NULL,
  ai_status text NOT NULL DEFAULT 'pending',
  ai_normal real,
  ai_pneumonia real,
  ai_tb real,
  ai_label text,
  ai_findings jsonb,
  ai_impression text,
  ai_image_quality text,
  ai_error text
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.scans TO authenticated;
GRANT ALL ON public.scans TO service_role;

ALTER TABLE public.scans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own scans" ON public.scans FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own scans" ON public.scans FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own scans" ON public.scans FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own scans" ON public.scans FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX scans_user_created_idx ON public.scans (user_id, created_at DESC);

CREATE POLICY "Users read own xray files" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'xrays' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users upload own xray files" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'xrays' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users delete own xray files" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'xrays' AND (storage.foldername(name))[1] = auth.uid()::text);