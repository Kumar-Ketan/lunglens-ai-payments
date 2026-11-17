CREATE TABLE public.consultations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  scan_id uuid NOT NULL REFERENCES public.scans(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  doctor_id text NOT NULL,
  doctor_name text NOT NULL,
  specialty text NOT NULL,
  slot_at timestamptz NOT NULL,
  patient_name text NOT NULL,
  patient_phone text NOT NULL,
  concern text,
  detected_condition text NOT NULL,
  amount_paise integer NOT NULL,
  currency text NOT NULL DEFAULT 'INR',
  status text NOT NULL DEFAULT 'pending_payment',
  payment_method text,
  payment_ref text,
  paid_at timestamptz,
  is_test_payment boolean NOT NULL DEFAULT true,
  razorpay_order_id text,
  CONSTRAINT consultations_status_check CHECK (status IN ('pending_payment', 'confirmed', 'cancelled'))
);

GRANT SELECT ON public.consultations TO authenticated;
GRANT ALL ON public.consultations TO service_role;

ALTER TABLE public.consultations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own consultations" ON public.consultations
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE INDEX consultations_user_created_idx ON public.consultations (user_id, created_at DESC);
CREATE INDEX consultations_scan_idx ON public.consultations (scan_id);
CREATE UNIQUE INDEX consultations_doctor_slot_confirmed_idx
  ON public.consultations (doctor_id, slot_at) WHERE status = 'confirmed';
CREATE UNIQUE INDEX consultations_razorpay_order_idx
  ON public.consultations (razorpay_order_id) WHERE razorpay_order_id IS NOT NULL;