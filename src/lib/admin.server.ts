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

// Alfabeto sem caracteres ambíguos (0/O, 1/l/I) — a senha é ditada por WhatsApp.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const DIGITS = "23456789";

/** Gera uma senha temporária curta, legível e aleatória (ex.: "PGKD-4827"). */
export function generateTempPassword(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  let letters = "";
  for (let i = 0; i < 4; i++) letters += ALPHABET[bytes[i]! % ALPHABET.length];
  let numbers = "";
  for (let i = 4; i < 8; i++) numbers += DIGITS[bytes[i]! % DIGITS.length];
  return `${letters}-${numbers}`;
}
