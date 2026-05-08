ALTER TABLE public.evolution_config 
ADD COLUMN IF NOT EXISTS cleanup_time TEXT DEFAULT '00:00',
ADD COLUMN IF NOT EXISTS cleanup_enabled BOOLEAN DEFAULT false;

-- Add comment to explain the columns
COMMENT ON COLUMN public.evolution_config.cleanup_time IS 'Time of day (HH:mm) to run the automatic cleanup of conversations.';
COMMENT ON COLUMN public.evolution_config.cleanup_enabled IS 'Whether the automatic cleanup of conversations is enabled for this user.';