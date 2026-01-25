-- Add payment_link column to products table for hosted payment page URLs
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS payment_link text;