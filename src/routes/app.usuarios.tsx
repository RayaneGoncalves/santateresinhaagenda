import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useUserRoles } from "@/lib/use-roles";
import { deleteUser, generateInviteLink, listUsers, regenerateInviteLink, setUserRole } from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Plus, Copy, Link2, Trash2, Search } from "lucide-react";

export const Route = createFileRoute("/app/usuarios")({
  component: UsersPage,
});

type Row = {
  id: string;
  email: string | undefined;
  full_name: string | null;
  roles: string[];
  last_sign_in_at: string | null | undefined;
};

const ROLE_OPTIONS = [
  { value: "user", label: "Membro" },
  { value: "coordenador", label: "Coordenador" },
  { value: "coordenacao", label: "Coordenação geral" },
  { value: "padre", label: "Padre" },
  { value: "admin", label: "Administrador" },
];

function roleLabel(r: string) {
  return ROLE_OPTIONS.find((o) => o.value === r)?.label ?? r;
}

function UsersPage() {
  const { isAdmin, loading: rolesLoading } = useUserRoles();
  const [rows, setRows] = useState<Row[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    email: "",
    full_name: "",
    role: "user" as "user" | "admin" | "padre" | "coordenacao" | "coordenador",
  });
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [resendLink, setResendLink] = useState<{ email: string; link: string } | null>(null);

  async function load() {
    try {
      const data = await listUsers();
      setRows(data);
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao carregar");
    }
  }
  useEffect(() => {
    if (isAdmin) load();
  }, [isAdmin]);

  async function invite() {
    if (!form.email || !form.full_name) return toast.error("Preencha nome e e-mail");
    setBusy(true);
    setLink(null);
    try {
      const res = await generateInviteLink({
        data: {
          email: form.email,
          full_name: form.full_name,
          role: form.role,
          redirect_to: window.location.origin + "/reset-password",
        },
      });
      setLink(res.action_link ?? null);
      toast.success("Convite gerado!");
      load();
    } catch (e: any) {
      toast.error(e?.message ?? "Erro");
    } finally {
      setBusy(false);
    }
  }

  async function changeRole(userId: string, role: string) {
    try {
      await setUserRole({ data: { user_id: userId, role: role as any } });
      toast.success("Papel atualizado");
      load();
    } catch (e: any) {
      toast.error(e?.message ?? "Erro");
    }
  }

  async function resend(email: string) {
    try {
      const res = await regenerateInviteLink({
        data: { email, redirect_to: window.location.origin + "/reset-password" },
      });
      if (res.action_link) {
        setResendLink({ email, link: res.action_link });
        toast.success("Novo link gerado");
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Erro");
    }
  }

  async function remove(userId: string, email?: string) {
    if (!confirm(`Excluir definitivamente o usuário ${email ?? ""}? Esta ação não pode ser desfeita.`))
      return;
    try {
      await deleteUser({ data: { user_id: userId } });
      toast.success("Usuário removido");
      load();
    } catch (e: any) {
      toast.error(e?.message ?? "Erro");
    }
  }

  if (rolesLoading) return <p className="text-muted-foreground">Carregando…</p>;
  if (!isAdmin)
    return (
      <p className="rounded-xl border bg-card p-6 text-muted-foreground">
        Apenas administradores podem gerenciar usuários.
      </p>
    );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl">Usuários</h1>
        <Button
          onClick={() => {
            setForm({ email: "", full_name: "", role: "user" });
            setLink(null);
            setOpen(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" /> Novo usuário
        </Button>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nome ou e-mail…"
          className="pl-9"
        />
      </div>

      <div className="overflow-hidden rounded-2xl border bg-card shadow-[var(--shadow-card)]">
        <table className="w-full text-sm">
          <thead className="bg-secondary/40 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">Nome</th>
              <th className="px-3 py-2 text-left">Email</th>
              <th className="px-3 py-2 text-left">Papel</th>
              <th className="px-3 py-2 text-left">Último acesso</th>
              <th className="px-3 py-2 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {rows
              .filter((r) => {
                const q = search.trim().toLowerCase();
                if (!q) return true;
                return (
                  (r.full_name ?? "").toLowerCase().includes(q) ||
                  (r.email ?? "").toLowerCase().includes(q)
                );
              })
              .map((r) => {
                const primary = r.roles.find((x) => x !== "user") ?? "user";
                const neverLogged = !r.last_sign_in_at;
                return (
                  <tr key={r.id} className="border-t">
                    <td className="px-3 py-2">{r.full_name ?? "—"}</td>
                    <td className="px-3 py-2">{r.email}</td>
                    <td className="px-3 py-2">
                      <Select value={primary} onValueChange={(v) => changeRole(r.id, v)}>
                        <SelectTrigger className="h-8 w-[180px]">
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
                      {r.last_sign_in_at
                        ? new Date(r.last_sign_in_at).toLocaleString("pt-BR")
                        : <span className="text-amber-600">Nunca acessou</span>}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          title={neverLogged ? "Reenviar link de cadastro" : "Enviar link para redefinir senha"}
                          onClick={() => r.email && resend(r.email)}
                        >
                          <Link2 className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          title="Excluir usuário"
                          onClick={() => remove(r.id, r.email)}
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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cadastrar novo usuário</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome completo</Label>
              <Input
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              />
            </div>
            <div>
              <Label>Email</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div>
              <Label>Papel</Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as any })}>
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
            </div>

            {link && (
              <div className="rounded-md border bg-secondary/40 p-3 space-y-2">
                <p className="text-xs text-muted-foreground">
                  Envie este link ao usuário (WhatsApp, e-mail, etc.). Ele expira em 1h.
                </p>
                <div className="flex gap-2">
                  <Input readOnly value={link} className="text-xs" />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      navigator.clipboard.writeText(link);
                      toast.success("Copiado");
                    }}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Fechar
            </Button>
            <Button onClick={invite} disabled={busy}>
              Gerar convite
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!resendLink} onOpenChange={(o) => !o && setResendLink(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Link gerado</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              Envie este link para <strong>{resendLink?.email}</strong>. Ele expira em 1h.
            </p>
            <div className="flex gap-2">
              <Input readOnly value={resendLink?.link ?? ""} className="text-xs" />
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  if (resendLink?.link) {
                    navigator.clipboard.writeText(resendLink.link);
                    toast.success("Copiado");
                  }
                }}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setResendLink(null)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
