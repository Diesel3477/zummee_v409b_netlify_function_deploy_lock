-- Zummee v337 Maintenance Updates permissions
-- Run in Supabase SQL Editor if Live Maintenance still shows 401/42501.

ALTER TABLE public.resident_work_orders ENABLE ROW LEVEL SECURITY;

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT ON TABLE public.resident_work_orders TO authenticated;

DROP POLICY IF EXISTS "Allow read access to work orders" ON public.resident_work_orders;
DROP POLICY IF EXISTS "Allow authenticated read resident work orders" ON public.resident_work_orders;

CREATE POLICY "Allow authenticated read resident work orders"
ON public.resident_work_orders
FOR SELECT
TO authenticated
USING (true);
