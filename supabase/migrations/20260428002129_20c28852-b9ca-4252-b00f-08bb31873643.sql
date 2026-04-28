-- 1. Add category to events
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'outro';

-- 2. Roles system
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'user',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE POLICY "Roles viewable by authenticated"
  ON public.user_roles FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins manage roles"
  ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 3. Liturgical events table
CREATE TABLE public.liturgical_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  event_date date NOT NULL,
  liturgical_color text NOT NULL DEFAULT 'verde',
  celebration_type text NOT NULL DEFAULT 'memoria',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.liturgical_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Liturgical events viewable by all authenticated"
  ON public.liturgical_events FOR SELECT TO authenticated USING (true);

CREATE POLICY "Only admins insert liturgical events"
  ON public.liturgical_events FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins update liturgical events"
  ON public.liturgical_events FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins delete liturgical events"
  ON public.liturgical_events FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER set_liturgical_events_updated_at
  BEFORE UPDATE ON public.liturgical_events
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_liturgical_events_date ON public.liturgical_events(event_date);

-- 4. Seed liturgical calendar 2026 (main celebrations)
INSERT INTO public.liturgical_events (title, description, event_date, liturgical_color, celebration_type) VALUES
('Solenidade de Maria, Mãe de Deus', 'Oitava do Natal', '2026-01-01', 'branco', 'solenidade'),
('Epifania do Senhor', 'Manifestação do Senhor aos magos', '2026-01-04', 'branco', 'solenidade'),
('Batismo do Senhor', 'Encerra o Tempo do Natal', '2026-01-11', 'branco', 'festa'),
('Apresentação do Senhor', 'Festa das Candeias', '2026-02-02', 'branco', 'festa'),
('Quarta-feira de Cinzas', 'Início da Quaresma', '2026-02-18', 'roxo', 'tempo'),
('1º Domingo da Quaresma', null, '2026-02-22', 'roxo', 'tempo'),
('2º Domingo da Quaresma', null, '2026-03-01', 'roxo', 'tempo'),
('3º Domingo da Quaresma', null, '2026-03-08', 'roxo', 'tempo'),
('4º Domingo da Quaresma (Laetare)', 'Domingo da alegria', '2026-03-15', 'rosa', 'tempo'),
('5º Domingo da Quaresma', null, '2026-03-22', 'roxo', 'tempo'),
('Solenidade de São José', 'Esposo da Virgem Maria', '2026-03-19', 'branco', 'solenidade'),
('Anunciação do Senhor', null, '2026-03-25', 'branco', 'solenidade'),
('Domingo de Ramos', 'Início da Semana Santa', '2026-03-29', 'vermelho', 'solenidade'),
('Quinta-feira Santa', 'Ceia do Senhor', '2026-04-02', 'branco', 'solenidade'),
('Sexta-feira Santa', 'Paixão do Senhor', '2026-04-03', 'vermelho', 'solenidade'),
('Vigília Pascal', 'Sábado Santo', '2026-04-04', 'branco', 'solenidade'),
('Domingo de Páscoa', 'Ressurreição do Senhor', '2026-04-05', 'branco', 'solenidade'),
('Divina Misericórdia', '2º Domingo da Páscoa', '2026-04-12', 'branco', 'festa'),
('Ascensão do Senhor', null, '2026-05-17', 'branco', 'solenidade'),
('Pentecostes', 'Vinda do Espírito Santo', '2026-05-24', 'vermelho', 'solenidade'),
('Santíssima Trindade', null, '2026-05-31', 'branco', 'solenidade'),
('Corpus Christi', 'Santíssimo Corpo e Sangue de Cristo', '2026-06-07', 'branco', 'solenidade'),
('Sagrado Coração de Jesus', null, '2026-06-12', 'branco', 'solenidade'),
('Imaculado Coração de Maria', null, '2026-06-13', 'branco', 'memoria'),
('Natividade de São João Batista', null, '2026-06-24', 'branco', 'solenidade'),
('São Pedro e São Paulo', 'Apóstolos', '2026-06-29', 'vermelho', 'solenidade'),
('Transfiguração do Senhor', null, '2026-08-06', 'branco', 'festa'),
('Assunção de Nossa Senhora', null, '2026-08-15', 'branco', 'solenidade'),
('Exaltação da Santa Cruz', null, '2026-09-14', 'vermelho', 'festa'),
('Nossa Senhora Aparecida', 'Padroeira do Brasil', '2026-10-12', 'branco', 'solenidade'),
('Todos os Santos', null, '2026-11-01', 'branco', 'solenidade'),
('Finados', 'Comemoração de todos os fiéis defuntos', '2026-11-02', 'roxo', 'memoria'),
('Cristo Rei do Universo', 'Último domingo do Tempo Comum', '2026-11-22', 'branco', 'solenidade'),
('1º Domingo do Advento', 'Início do Ano Litúrgico', '2026-11-29', 'roxo', 'tempo'),
('Imaculada Conceição de Maria', null, '2026-12-08', 'branco', 'solenidade'),
('2º Domingo do Advento', null, '2026-12-06', 'roxo', 'tempo'),
('3º Domingo do Advento (Gaudete)', 'Domingo da alegria', '2026-12-13', 'rosa', 'tempo'),
('4º Domingo do Advento', null, '2026-12-20', 'roxo', 'tempo'),
('Natal do Senhor', 'Nascimento de Nosso Senhor Jesus Cristo', '2026-12-25', 'branco', 'solenidade'),
('Sagrada Família', null, '2026-12-27', 'branco', 'festa');