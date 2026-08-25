// Helpers de celular — módulo puro, seguro no cliente e no servidor.

/** Domínio interno usado para transformar o celular em identidade de login. */
export const PHONE_DOMAIN = "celular.local";

/**
 * Normaliza um celular brasileiro para apenas dígitos com DDI 55.
 * Aceita "(11) 99999-8888", "11999998888", "5511999998888".
 * Retorna null quando o número não é válido.
 */
export function normalizePhone(input: string): string | null {
  let digits = (input ?? "").replace(/\D/g, "");
  if (!digits) return null;

  // remove zeros de operadora/DDD no início
  digits = digits.replace(/^0+/, "");

  if (digits.length === 10 || digits.length === 11) {
    digits = "55" + digits;
  }

  // 55 + DDD(2) + número(8 ou 9)
  if (!/^55\d{10,11}$/.test(digits)) return null;
  return digits;
}

/** Converte o celular normalizado no e-mail interno usado pelo login. */
export function phoneToLoginEmail(phoneDigits: string): string {
  return `${phoneDigits}@${PHONE_DOMAIN}`;
}

/** True quando o texto digitado parece um e-mail de verdade. */
export function looksLikeEmail(input: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((input ?? "").trim());
}

/**
 * Resolve o que o usuário digitou no campo de login (celular OU e-mail)
 * para o e-mail que será enviado ao servidor de autenticação.
 */
export function resolveLoginIdentifier(input: string): string | null {
  const raw = (input ?? "").trim();
  if (!raw) return null;
  if (looksLikeEmail(raw)) return raw.toLowerCase();
  const phone = normalizePhone(raw);
  return phone ? phoneToLoginEmail(phone) : null;
}

/** Formata para exibição: (11) 99999-8888 */
export function formatPhone(phoneDigits: string | null | undefined): string {
  if (!phoneDigits) return "—";
  const d = phoneDigits.replace(/\D/g, "").replace(/^55/, "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return phoneDigits;
}

/** Esconde o e-mail interno na interface — mostra só celular quando for o caso. */
export function isInternalPhoneEmail(email: string | null | undefined): boolean {
  return !!email && email.endsWith(`@${PHONE_DOMAIN}`);
}
