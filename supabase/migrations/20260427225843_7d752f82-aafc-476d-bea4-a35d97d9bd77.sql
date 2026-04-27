alter publication supabase_realtime add table public.events;
alter table public.events replica identity full;