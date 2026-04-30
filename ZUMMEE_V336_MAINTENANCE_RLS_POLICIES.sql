-- ZUMMEE v336 - resident_work_orders policies for Manager Hub + Live Maintenance
-- Run in Supabase SQL Editor.

ALTER TABLE public.resident_work_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Zummee authenticated read resident work orders" ON public.resident_work_orders;
CREATE POLICY "Zummee authenticated read resident work orders"
ON public.resident_work_orders
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Zummee authenticated insert resident work orders" ON public.resident_work_orders;
CREATE POLICY "Zummee authenticated insert resident work orders"
ON public.resident_work_orders
FOR INSERT
TO authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "Zummee authenticated update resident work orders" ON public.resident_work_orders;
CREATE POLICY "Zummee authenticated update resident work orders"
ON public.resident_work_orders
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='maintenance_request_events') THEN
    EXECUTE 'ALTER TABLE public.maintenance_request_events ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "Zummee authenticated read maintenance events" ON public.maintenance_request_events';
    EXECUTE 'CREATE POLICY "Zummee authenticated read maintenance events" ON public.maintenance_request_events FOR SELECT TO authenticated USING (true)';
  END IF;
END $$;
