import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

export type AppRole = "admin" | "user" | "padre" | "coordenacao" | "coordenador";

export function useUserRoles() {
  const { user } = useAuth();
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setRoles([]);
      setLoading(false);
      return;
    }
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .then(({ data }) => {
        setRoles((data?.map((r) => r.role) as AppRole[]) ?? []);
        setLoading(false);
      });
  }, [user]);

  const has = (r: AppRole) => roles.includes(r);
  const canApproveEvents = has("admin") || has("padre") || has("coordenacao");
  const isAdmin = has("admin");

  return { roles, loading, has, canApproveEvents, isAdmin };
}
