import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import type { Database } from "@/integrations/supabase/types";

type AdminAuthContext = {
  supabase: SupabaseClient<Database>;
  userId: string;
};

function authenticationError(message: string): Error {
  return new Error(`Sessão inválida: ${message}. Entre novamente e tente de novo.`);
}

export const requireAdminAuth = createMiddleware({ type: "function" }).server(
  async ({ next }) => {
    const supabaseUrl = process.env["SUPABASE_URL"];
    const publishableKey = process.env["SUPABASE_PUBLISHABLE_KEY"];
    if (!supabaseUrl || !publishableKey) {
      throw new Error("Não foi possível acessar o serviço de autenticação.");
    }

    const authorization = getRequest().headers.get("authorization");
    const token = authorization?.startsWith("Bearer ")
      ? authorization.slice("Bearer ".length).trim()
      : "";
    if (!token) throw authenticationError("credencial ausente");

    const supabase = createClient<Database>(supabaseUrl, publishableKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: {
        storage: undefined,
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    const userId = claimsData?.claims?.sub;
    if (claimsError || typeof userId !== "string" || !userId) {
      throw authenticationError("credencial expirada");
    }

    const { data: isAdmin, error: roleError } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (roleError) throw new Error("Não foi possível confirmar sua permissão de administrador.");
    if (!isAdmin) throw new Error("Apenas administradores podem fazer isso.");

    return next({ context: { supabase, userId } satisfies AdminAuthContext });
  },
);