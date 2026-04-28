-- Defense-in-depth: restrictive policy ensures only admins can write to user_roles
-- regardless of any other permissive policies that might exist now or in the future.
CREATE POLICY "Restrict role writes to admins"
  ON public.user_roles
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));