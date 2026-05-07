-- Pastorais
CREATE TABLE public.pastorais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  color text NOT NULL DEFAULT '#c9847a',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.pastorais ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER pastorais_updated
BEFORE UPDATE ON public.pastorais
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY "pastorais view all auth"
  ON public.pastorais FOR SELECT TO authenticated USING (true);
CREATE POLICY "pastorais admin insert"
  ON public.pastorais FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "pastorais admin update"
  ON public.pastorais FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "pastorais admin delete"
  ON public.pastorais FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- Pastoral membership
CREATE TYPE public.pastoral_role AS ENUM ('coordenador', 'membro');

CREATE TABLE public.pastoral_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pastoral_id uuid NOT NULL REFERENCES public.pastorais(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role public.pastoral_role NOT NULL DEFAULT 'membro',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (pastoral_id, user_id)
);
ALTER TABLE public.pastoral_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pastoral_members view all auth"
  ON public.pastoral_members FOR SELECT TO authenticated USING (true);
CREATE POLICY "pastoral_members admin manage"
  ON public.pastoral_members FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- Helper functions
CREATE OR REPLACE FUNCTION public.is_pastoral_member(_user_id uuid, _pastoral_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.pastoral_members
    WHERE user_id = _user_id AND pastoral_id = _pastoral_id
  );
$$;

CREATE OR REPLACE FUNCTION public.is_pastoral_coordenador(_user_id uuid, _pastoral_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.pastoral_members
    WHERE user_id = _user_id AND pastoral_id = _pastoral_id AND role = 'coordenador'
  );
$$;

CREATE OR REPLACE FUNCTION public.can_approve_events(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    public.has_role(_user_id, 'admin')
    OR public.has_role(_user_id, 'padre')
    OR public.has_role(_user_id, 'coordenacao');
$$;

REVOKE EXECUTE ON FUNCTION public.is_pastoral_member(uuid, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_pastoral_coordenador(uuid, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.can_approve_events(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.is_pastoral_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_pastoral_coordenador(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_approve_events(uuid) TO authenticated;

-- Events: add pastoral and approval status
CREATE TYPE public.event_status AS ENUM ('pendente', 'aprovado', 'rejeitado');

ALTER TABLE public.events
  ADD COLUMN pastoral_id uuid REFERENCES public.pastorais(id) ON DELETE SET NULL,
  ADD COLUMN status public.event_status NOT NULL DEFAULT 'pendente',
  ADD COLUMN approved_by uuid,
  ADD COLUMN approved_at timestamptz;

CREATE INDEX events_pastoral_time_idx ON public.events (pastoral_id, starts_at, ends_at);

-- Conflict trigger: same pastoral cannot have overlapping events (excluding rejected)
CREATE OR REPLACE FUNCTION public.events_prevent_overlap()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.pastoral_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.status = 'rejeitado' THEN
    RETURN NEW;
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.events e
    WHERE e.pastoral_id = NEW.pastoral_id
      AND e.id <> NEW.id
      AND e.status <> 'rejeitado'
      AND tstzrange(e.starts_at, e.ends_at, '[)') && tstzrange(NEW.starts_at, NEW.ends_at, '[)')
  ) THEN
    RAISE EXCEPTION 'Já existe um evento desta pastoral no mesmo horário.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER events_no_overlap
BEFORE INSERT OR UPDATE OF starts_at, ends_at, pastoral_id, status ON public.events
FOR EACH ROW EXECUTE FUNCTION public.events_prevent_overlap();

-- Replace event policies
DROP POLICY IF EXISTS "Users can insert own events" ON public.events;
DROP POLICY IF EXISTS "Users can update own events" ON public.events;
DROP POLICY IF EXISTS "Users can delete own events" ON public.events;

-- INSERT: must be member of the pastoral (or admin); user_id must equal auth.uid; status starts pendente unless approver
CREATE POLICY "Insert events as pastoral member"
  ON public.events FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND pastoral_id IS NOT NULL
    AND (
      public.is_pastoral_member(auth.uid(), pastoral_id)
      OR public.has_role(auth.uid(), 'admin')
    )
  );

-- UPDATE: author, pastoral coordinator, or approver
CREATE POLICY "Update events"
  ON public.events FOR UPDATE TO authenticated
  USING (
    auth.uid() = user_id
    OR public.is_pastoral_coordenador(auth.uid(), pastoral_id)
    OR public.can_approve_events(auth.uid())
  );

-- DELETE: author, pastoral coordinator, or approver
CREATE POLICY "Delete events"
  ON public.events FOR DELETE TO authenticated
  USING (
    auth.uid() = user_id
    OR public.is_pastoral_coordenador(auth.uid(), pastoral_id)
    OR public.can_approve_events(auth.uid())
  );
