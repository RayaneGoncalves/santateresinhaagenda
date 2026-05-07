-- 1. Add new roles
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'padre';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'coordenacao';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'coordenador';
