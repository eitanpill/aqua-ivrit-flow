-- Add missing columns to transactions table
ALTER TABLE public.transactions 
ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES public.schools(id),
ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'manual';

-- Add missing column to invoices table
ALTER TABLE public.invoices 
ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES public.schools(id);

-- Create index for school_id lookups
CREATE INDEX IF NOT EXISTS idx_transactions_school_id ON public.transactions(school_id);
CREATE INDEX IF NOT EXISTS idx_invoices_school_id ON public.invoices(school_id);

-- Add service_role policies for Edge Functions
CREATE POLICY "Service role full access transactions" 
ON public.transactions 
FOR ALL 
TO service_role 
USING (true) 
WITH CHECK (true);

CREATE POLICY "Service role full access invoices" 
ON public.invoices 
FOR ALL 
TO service_role 
USING (true) 
WITH CHECK (true);

-- Staff can view all transactions in their school
CREATE POLICY "Staff can view school transactions" 
ON public.transactions 
FOR SELECT 
USING (is_super_admin() OR (is_staff(auth.uid()) AND school_id = get_user_school_id()));

-- Staff can insert transactions
CREATE POLICY "Staff can insert transactions" 
ON public.transactions 
FOR INSERT 
WITH CHECK (is_super_admin() OR (is_staff(auth.uid()) AND school_id = get_user_school_id()));

-- Staff can view all invoices in their school
CREATE POLICY "Staff can view school invoices" 
ON public.invoices 
FOR SELECT 
USING (is_super_admin() OR (is_staff(auth.uid()) AND school_id = get_user_school_id()));