// Official Catholic liturgical colors (hex)
export const LITURGICAL_COLORS: Record<string, { hex: string; label: string; textLight: boolean }> = {
  roxo: { hex: "#6B46C1", label: "Roxo (Advento/Quaresma)", textLight: true },
  branco: { hex: "#F7F3E9", label: "Branco (Festas do Senhor, Maria, Santos)", textLight: false },
  vermelho: { hex: "#C8102E", label: "Vermelho (Pentecostes, Mártires)", textLight: true },
  verde: { hex: "#2E7D32", label: "Verde (Tempo Comum)", textLight: true },
  rosa: { hex: "#F06292", label: "Rosa (Gaudete e Laetare)", textLight: true },
  dourado: { hex: "#D4AF37", label: "Dourado (Solenidades)", textLight: false },
  preto: { hex: "#1a1a1a", label: "Preto (Finados)", textLight: true },
};

export const CELEBRATION_TYPES = [
  { value: "solenidade", label: "Solenidade" },
  { value: "festa", label: "Festa" },
  { value: "memoria", label: "Memória" },
  { value: "tempo", label: "Tempo Litúrgico" },
];

export const EVENT_CATEGORIES = [
  { value: "missa", label: "Missa" },
  { value: "batizado", label: "Batizado" },
  { value: "casamento", label: "Casamento" },
  { value: "pastoral", label: "Reunião de Pastoral" },
  { value: "coro", label: "Ensaio de Coro" },
  { value: "catequese", label: "Catequese" },
  { value: "reuniao", label: "Reunião" },
  { value: "outro", label: "Outro" },
];

export function categoryLabel(value: string) {
  return EVENT_CATEGORIES.find((c) => c.value === value)?.label ?? "Outro";
}
