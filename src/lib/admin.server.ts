// Server-only helpers for admin operations.
// Never import this file at module scope from client-reachable modules —
// load it inside handlers with: await import("./admin.server")
import type { SupabaseClient } from "@supabase/supabase-js";

export async function assertAdmin(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Apenas administradores podem fazer isso.");
}
