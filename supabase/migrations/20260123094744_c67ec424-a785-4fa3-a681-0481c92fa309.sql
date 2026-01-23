-- Add notification webhook URL to schools table
ALTER TABLE public.schools 
ADD COLUMN IF NOT EXISTS notification_webhook_url TEXT;

-- Add comment for documentation
COMMENT ON COLUMN public.schools.notification_webhook_url IS 'Webhook URL for sending AI-generated notifications to external systems (Make/n8n)';