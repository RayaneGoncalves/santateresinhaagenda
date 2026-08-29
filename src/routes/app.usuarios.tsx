import { createFileRoute, useServerFn } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useUserRoles } from "@/lib/use-roles";
import { supabase } from "@/integrations/supabase/client";
import {
  createAccess,
  deleteUser,
  listUsers,
  resetTempPassword,
  setUserRole,
} from "@/lib/admin.functions";
import { formatPhone, isInternalPhoneEmail, normalizePhone } from "@/lib/phone";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Copy, KeyRound, Trash2, Search, MessageCircle } from "lucide-react";

export const Route = createFileRoute("/app/usuarios")({
  head: () => ({
    meta: [
      { title: "Usuários e acessos — Agenda Paroquial" },
      {
        name: "description",
        content:
          "Cadastre acessos da paróquia com nome e celular, defina o papel e envie a senha temporária por WhatsApp.",
      },
    ],
  }),
  component: UsersPage,
});

type Row = {
  id: string;
  email: string | null;
  full_name: string | null;
  phone: string | null;
  must_change_password: boolean;
  roles: string[];
  pastorais: { name: string; role: string }[];
  last_sign_in_at: string | null;
};

type AppRoleValue = "user" | "admin" | "padre" | "coordenacao" | "coordenador";

const ROLE_OPTIONS: { value: AppRoleValue; label: string; help: string }[] = [
  { value: "user", label: "Membro", help: "Cria eventos da sua pastoral (precisam de aprovação)" },
  { value: "coordenador", label: "Coordenador de pastoral", help: "Gerencia os eventos da própria pastoral" },
  { value: "coordenacao", label: "Coordenação geral", help: "Aprova e rejeita eventos de todas as pastorais" },
  { value: "padre", label: "Padre", help: "Aprova e rejeita eventos de todas as pastorais" },
  { value: "admin", label: "Administrador", help: "Acesso total: usuários, pastorais e calendário litúrgico" },
];

function roleLabel(r: string) {
  return ROLE_OPTIONS.find((o) => o.value === r)?.label ?? r;
}

type Pastoral = { id: string; name: string };

type NewAccess = {
  full_name: string;
  phone: string;
  role: AppRoleValue;
  pastoral_id: string;
  pastoral_role: "coordenador" | "membro";
};

const EMPTY_FORM: NewAccess = {
  full_name: "",
  phone: "",
  role: "user",
  pastoral_id: "none",
  pastoral_role: "membro",
};

function UsersPage() {
  const { isAdmin, loading: rolesLoading } = useUserRoles();
  const listUsersFn = useServerFn(listUsers);
  const createAccessFn = useServerFn(createAccess);
  const setUserRoleFn = useServerFn(setUserRole);
  const resetTempPasswordFn = useServerFn(resetTempPassword);
  const deleteUserFn = useServerFn(deleteUser);
  const [rows, setRows] = useState<Row[]>([]);
  const [pastorais, setPastorais] = useState<Pastoral[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<NewAccess>(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [credential, setCredential] = useState<{
    name: string;
    phone: string;
    password: string;
  } | null>(null);

  async function load() {
    try {
      const data = await listUsersFn();
      setRows(data);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Erro ao carregar");
    }
  }

  async function loadPastorais() {
    const { data } = await supabase.from("pastorais").select("id, name").order("name");
    setPastorais(data ?? []);
  }

  useEffect(() => {
    if (isAdmin) {
      load();
      loadPastorais();
    }
  }, [isAdmin]);

  const loginUrl = typeof window !== "undefined" ? window.location.origin + "/auth" : "";

  const whatsappMessage = useMemo(() => {
    if (!credential) return "";
    return [
      `Olá, ${credential.name}! 🙏`,
      "",
      "Seu acesso à Agenda da Paróquia foi criado:",
      "",
      `🔗 Site: ${loginUrl}`,
      `📱 Celular: ${formatPhone(credential.phone)}`,
      `🔑 Senha temporária: ${credential.password}`,
      "",
      "No primeiro acesso o sistema vai pedir para você criar a sua própria senha.",
    ].join("\n");
  }, [credential, loginUrl]);

  async function submitAccess() {
    if (!form.full_name.trim()) return toast.error("Informe o nome completo");
    if (!normalizePhone(form.phone))
      return toast.error("Celular inválido. Use DDD + número, ex.: (11) 99999-8888");
    if (form.role === "coordenador" && form.pastoral_id === "none")
      return toast.error("Escolha a pastoral que essa pessoa vai coordenar");

    setBusy(true);
    try {
      const res = await createAccessFn({
        data: {
          full_name: form.full_name.trim(),
          phone: form.phone,
          role: form.role,
          pastoral_id: form.pastoral_id === "none" ? null : form.pastoral_id,
          pastoral_role: form.role === "coordenador" ? "coordenador" : form.pastoral_role,
        },
      });
      setCredential({
        name: form.full_name.trim(),
        phone: res.phone,
        password: res.temp_password,
      });
      setOpen(false);
      setForm(EMPTY_FORM);
      toast.success("Acesso criado!");
      load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Erro ao criar acesso");
    } finally {
      setBusy(false);
    }
  }

  async function changeRole(userId: string, role: string) {
    try {
      await setUserRoleFn({ data: { user_id: userId, role: role as AppRoleValue } });
      toast.success("Papel atualizado");
      load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
  }

  async function newPassword(row: Row) {
    if (!confirm(`Gerar uma nova senha temporária para ${row.full_name ?? "esta pessoa"}?`)) return;
    try {
      const res = await resetTempPasswordFn({ data: { user_id: row.id } });
      setCredential({
        name: row.full_name ?? "",
        phone: row.phone ?? "",
        password: res.temp_password,
      });
      toast.success("Nova senha gerada");
      load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
  }

  async function remove(row: Row) {
    if (
      !confirm(
        `Excluir definitivamente o acesso de ${row.full_name ?? "esta pessoa"}? Esta ação não pode ser desfeita.`,
      )
    )
      return;
    try {
      await deleteUserFn({ data: { user_id: row.id } });
      toast.success("Acesso removido");
      load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
  }

  if (rolesLoading) return <p className="text-muted-foreground">Carregando…</p>;
  if (!isAdmin)
    return (
      <p className="rounded-xl border bg-card p-6 text-muted-foreground">
        Apenas administradores podem gerenciar usuários.
      </p>
    );

  const filtered = rows.filter((r) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      (r.full_name ?? "").toLowerCase().includes(q) ||
      (r.phone ?? "").includes(q.replace(/\D/g, "")) ||
      (r.email ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl">Usuários e acessos</h1>
          <p className="text-sm text-muted-foreground">
            Cadastre com nome e celular, escolha o papel e envie a senha temporária pelo WhatsApp.
          </p>
        </div>
        <Button
          onClick={() => {
            setForm(EMPTY_FORM);
            setOpen(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" /> Criar acesso
        </Button>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nome ou celular…"
          className="pl-9"
        />
      </div>

      <div className="overflow-x-auto rounded-2xl border bg-card shadow-[var(--shadow-card)]">
        <table className="w-full text-sm">
          <thead className="bg-secondary/40 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">Nome</th>
              <th className="px-3 py-2 text-left">Celular / login</th>
              <th className="px-3 py-2 text-left">Papel</th>
              <th className="px-3 py-2 text-left">Pastoral</th>
              <th className="px-3 py-2 text-left">Situação</th>
              <th className="px-3 py-2 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">
                  Nenhum acesso encontrado.
                </td>
              </tr>
            )}
            {filtered.map((r) => {
              const primary = r.roles.find((x) => x !== "user") ?? "user";
              return (
                <tr key={r.id} className="border-t align-middle">
                  <td className="px-3 py-2 font-medium">{r.full_name ?? "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {r.phone
                      ? formatPhone(r.phone)
                      : isInternalPhoneEmail(r.email)
                        ? "—"
                        : r.email}
                  </td>
                  <td className="px-3 py-2">
                    <Select value={primary} onValueChange={(v) => changeRole(r.id, v)}>
                      <SelectTrigger className="h-8 w-[210px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ROLE_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {r.pastorais.length === 0
                      ? "—"
                      : r.pastorais
                          .map((p) => `${p.name}${p.role === "coordenador" ? " (coord.)" : ""}`)
                          .join(", ")}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {r.must_change_password ? (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-800">
                        Senha temporária
                      </span>
                    ) : r.last_sign_in_at ? (
                      <span className="text-muted-foreground">
                        Ativo · {new Date(r.last_sign_in_at).toLocaleDateString("pt-BR")}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">Nunca acessou</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        title="Gerar nova senha temporária"
                        onClick={() => newPassword(r)}
                      >
                        <KeyRound className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        title="Excluir acesso"
                        onClick={() => remove(r)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Criar acesso */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Criar acesso</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome completo</Label>
              <Input
                value={form.full_name}
                placeholder="Maria da Silva"
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              />
            </div>
            <div>
              <Label>Celular (com DDD)</Label>
              <Input
                value={form.phone}
                placeholder="(11) 99999-8888"
                inputMode="tel"
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                É com este número que a pessoa vai entrar no sistema.
              </p>
            </div>
            <div>
              <Label>Papel</Label>
              <Select
                value={form.role}
                onValueChange={(v) => setForm({ ...form, role: v as AppRoleValue })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="mt-1 text-xs text-muted-foreground">
                {ROLE_OPTIONS.find((o) => o.value === form.role)?.help}
              </p>
            </div>
            <div>
              <Label>Pastoral (opcional)</Label>
              <Select
                value={form.pastoral_id}
                onValueChange={(v) => setForm({ ...form, pastoral_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sem pastoral" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem pastoral</SelectItem>
                  {pastorais.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="mt-1 text-xs text-muted-foreground">
                Necessário para quem vai marcar eventos de uma pastoral.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={submitAccess} disabled={busy}>
              {busy ? "Criando…" : "Criar acesso"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Credenciais geradas */}
      <Dialog open={!!credential} onOpenChange={(o) => !o && setCredential(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Envie estes dados para a pessoa</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="rounded-xl border bg-secondary/40 p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Celular (login)</p>
              <p className="font-medium">{formatPhone(credential?.phone ?? "")}</p>
              <p className="mt-3 text-xs uppercase tracking-wide text-muted-foreground">
                Senha temporária
              </p>
              <p className="font-mono text-2xl tracking-wider text-primary">
                {credential?.password}
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              ⚠️ Esta senha aparece só agora. Se fechar sem enviar, use o botão da chave na lista
              para gerar outra.
            </p>

            <div>
              <Label>Mensagem pronta para WhatsApp</Label>
              <Textarea readOnly value={whatsappMessage} rows={9} className="mt-1 text-xs" />
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  navigator.clipboard.writeText(whatsappMessage);
                  toast.success("Mensagem copiada");
                }}
              >
                <Copy className="mr-2 h-4 w-4" /> Copiar mensagem
              </Button>
              <Button asChild>
                <a
                  href={`https://wa.me/${credential?.phone ?? ""}?text=${encodeURIComponent(whatsappMessage)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <MessageCircle className="mr-2 h-4 w-4" /> Abrir no WhatsApp
                </a>
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCredential(null)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
