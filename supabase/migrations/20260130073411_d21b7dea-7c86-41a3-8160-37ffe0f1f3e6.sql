-- Add payment_completed flag to profiles to track subscription payment status
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS subscription_paid BOOLEAN DEFAULT false;

-- Add subscription_paid_at timestamp
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS subscription_paid_at TIMESTAMPTZ DEFAULT NULL;

COMMENT ON COLUMN public.profiles.subscription_paid IS 'Whether the user has completed the initial subscription payment for school creation';
COMMENT ON COLUMN public.profiles.subscription_paid_at IS 'When the subscription payment was completed';