CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Create a function to be called by the cron job
CREATE OR REPLACE FUNCTION public.run_whatsapp_cleanup()
RETURNS void AS $$
DECLARE
    r RECORD;
    current_time_str TEXT;
BEGIN
    current_time_str := to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI');
    
    FOR r IN 
        SELECT user_id 
        FROM public.evolution_config 
        WHERE cleanup_enabled = true 
        AND cleanup_time <= current_time_str
        AND (last_cleanup_at IS NULL OR last_cleanup_at < CURRENT_DATE)
    LOOP
        -- Delete messages
        DELETE FROM public.whatsapp_messages WHERE user_id = r.user_id;
        
        -- Delete chats (keep them but clear last message? Or delete entirely?)
        -- The user said: "excluindo a conversa do app(nao do wpp real)"
        DELETE FROM public.whatsapp_chats WHERE user_id = r.user_id;
        
        -- Update last_cleanup_at
        UPDATE public.evolution_config 
        SET last_cleanup_at = now() 
        WHERE user_id = r.user_id;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add last_cleanup_at column
ALTER TABLE public.evolution_config ADD COLUMN IF NOT EXISTS last_cleanup_at TIMESTAMP WITH TIME ZONE;

-- Schedule the job to run every 10 minutes (to catch the specific time accurately)
SELECT cron.schedule('whatsapp-cleanup-job', '*/10 * * * *', 'SELECT public.run_whatsapp_cleanup()');
