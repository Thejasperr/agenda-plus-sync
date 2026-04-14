
-- Create table for webhook events
CREATE TABLE public.whatsapp_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL DEFAULT auth.uid(),
  event_type TEXT NOT NULL,
  remote_jid TEXT,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  processed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.whatsapp_events ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own whatsapp_events"
ON public.whatsapp_events FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own whatsapp_events"
ON public.whatsapp_events FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own whatsapp_events"
ON public.whatsapp_events FOR DELETE
USING (auth.uid() = user_id);

-- Service role needs to insert events from webhook (no auth context)
CREATE POLICY "Service role can insert events"
ON public.whatsapp_events FOR INSERT
TO service_role
WITH CHECK (true);

CREATE POLICY "Service role can select events"
ON public.whatsapp_events FOR SELECT
TO service_role
USING (true);

-- Index for realtime subscriptions
CREATE INDEX idx_whatsapp_events_user_created ON public.whatsapp_events (user_id, created_at DESC);
CREATE INDEX idx_whatsapp_events_remote_jid ON public.whatsapp_events (remote_jid);

-- Enable realtime for this table
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_events;
