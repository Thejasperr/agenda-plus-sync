DELETE FROM public.whatsapp_messages
WHERE id IN (
  SELECT id FROM public.whatsapp_messages
  WHERE user_id = '929f737c-4e50-4f4c-9e27-3c08bc28e5ce'
  ORDER BY timestamp ASC, created_at ASC
  LIMIT 500
);