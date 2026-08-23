ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone text;

ALTER TABLE public.pastoral_members
  ADD CONSTRAINT pastoral_members_pastoral_user_unique UNIQUE (pastoral_id, user_id);