-- 1. Restrict has_role execution to authenticated users only
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

-- 2. Restrict user_roles SELECT to own row (admins still covered by "Admins manage roles" ALL policy)
DROP POLICY IF EXISTS "Roles viewable by authenticated" ON public.user_roles;
CREATE POLICY "Users view own role"
  ON public.user_roles FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- 3. Add RLS policies on realtime.messages so only authenticated users can subscribe to channels
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can receive broadcasts" ON realtime.messages;
CREATE POLICY "Authenticated can receive broadcasts"
  ON realtime.messages FOR SELECT TO authenticated
  USING (true);
