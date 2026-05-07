import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

export type AppRole =
  | "admin"
  | "user"
  | "padre"
  | "coordenacao"
  | "coordenador";

export function useUserRoles() {
  const { user } = useAuth();

  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadRoles() {
      if (!user) {
        setRoles([]);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);

        const { data, error } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id);

        if (error) {
          console.error("Erro ao buscar roles:", error);
          setRoles([]);
          return;
        }

        const mappedRoles: AppRole[] =
          data?.map((r) => r.role as AppRole) ?? [];

        setRoles(mappedRoles);
      } catch (err) {
        console.error("Erro inesperado:", err);
        setRoles([]);
      } finally {
        setLoading(false);
      }
    }

    loadRoles();
  }, [user]);

  const has = (role: AppRole) => roles.includes(role);

  const canApproveEvents =
    has("admin") ||
    has("padre") ||
    has("coordenacao");

  const isAdmin = has("admin");

  return {
    roles,
    loading,
    has,
    canApproveEvents,
    isAdmin,
  };
}