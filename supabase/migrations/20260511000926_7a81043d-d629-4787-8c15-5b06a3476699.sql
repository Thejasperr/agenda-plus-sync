-- Fix user_id column in cliente_pacotes
ALTER TABLE public.cliente_pacotes 
ALTER COLUMN user_id SET DEFAULT auth.uid();

-- Ensure all existing records have a user_id if they are missing it (fallback to a sensible default or leave as is if no records exist)
-- In this case, we just want to make sure new inserts work correctly.

-- If there are any missing user_ids and we can't determine them, we might want to set them to a specific user if this is a single-user app, 
-- but since we're using RLS with auth.uid(), the safest is to let new inserts handle it.
