import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRoles } from "@/lib/use-roles";
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
import { Plus, Trash2, Users, Search } from "lucide-react";

export const Route = createFileRoute("/app/pastorais")({
  component: PastoraisPage,
});

type Pastoral = {
  id: string;
  name: string;
  description: string | null;
  color: string;
};
type Member = {
  id: string;
  pastoral_id: string;
  user_id: string;
  role: "coordenador" | "membro";
};
type Profile = { id: string; full_name: string | null };

function PastoraisPage() {
  const { isAdmin, loading: rolesLoading } = useUserRoles();
  const [pastorais, setPastorais] = useState<Pastoral[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Pastoral | null>(null);
  const [form, setForm] = useState({ name: "", description: "", color: "#c9847a" });

  const [memberOpen, setMemberOpen] = useState<Pastoral | null>(null);
  const [newMember, setNewMember] = useState({ user_id: "", role: "membro" as "coordenador" | "membro" });
  const [search, setSearch] = useState("");

  async function load() {
    const [{ data: p }, { data: m }, { data: pr }] = await Promise.all([
      supabase.from("pastorais").select("*").order("name"),
      supabase.from("pastoral_members").select("*"),
      supabase.from("profiles").select("id, full_name").order("full_name"),
    ]);
    setPastorais(p ?? []);
    setMembers(m ?? []);
    setProfiles(pr ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  function openCreate() {
    setEditing(null);
    setForm({ name: "", description: "", color: "#c9847a" });
    setOpen(true);
  }
  function openEdit(p: Pastoral) {
    setEditing(p);
    setForm({ name: p.name, description: p.description ?? "", color: p.color });
    setOpen(true);
  }

  async function save() {
    if (!form.name.trim()) return toast.error("Nome obrigatório");
    if (editing) {
      const { error } = await supabase
        .from("pastorais")
        .update({ name: form.name.trim(), description: form.description.trim() || null, color: form.color })
        .eq("id", editing.id);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase
        .from("pastorais")
        .insert({ name: form.name.trim(), description: form.description.trim() || null, color: form.color });
      if (error) return toast.error(error.message);
    }
    toast.success("Salvo");
    setOpen(false);
    load();
  }

  async function remove(p: Pastoral) {
    if (!confirm(`Remover "${p.name}"? Eventos vinculados ficarão sem pastoral.`)) return;
    const { error } = await supabase.from("pastorais").delete().eq("id", p.id);
    if (error) return toast.error(error.message);
    toast.success("Pastoral removida");
    load();
  }

  async function addMember() {
    if (!memberOpen || !newMember.user_id) return;
    const { error } = await supabase
      .from("pastoral_members")
      .insert({ pastoral_id: memberOpen.id, user_id: newMember.user_id, role: newMember.role });
    if (error) return toast.error(error.message);
    setNewMember({ user_id: "", role: "membro" });
    load();
  }
  async function removeMember(id: string) {
    const { error } = await supabase.from("pastoral_members").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  }

  if (rolesLoading) return <p className="text-muted-foreground">Carregando…</p>;
  if (!isAdmin)
    return (
      <p className="rounded-xl border bg-card p-6 text-muted-foreground">
        Apenas administradores podem gerenciar pastorais.
      </p>
    );

  const profileName = (id: string) => profiles.find((p) => p.id === id)?.full_name ?? id.slice(0, 8);
  const pastoralMembers = (pid: string) => members.filter((m) => m.pastoral_id === pid);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl">Pastorais</h1>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" /> Nova pastoral
        </Button>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar pastoral…"
          className="pl-9"
        />
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {pastorais
          .filter((p) => !search.trim() || p.name.toLowerCase().includes(search.trim().toLowerCase()))
          .map((p) => (
          <div key={p.id} className="rounded-2xl border bg-card p-4 shadow-[var(--shadow-card)]">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <span
                  className="inline-block h-4 w-4 rounded-full"
                  style={{ backgroundColor: p.color }}
                />
                <div>
                  <h3 className="font-display text-lg">{p.name}</h3>
                  {p.description && (
                    <p className="text-xs text-muted-foreground">{p.description}</p>
                  )}
                </div>
              </div>
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" onClick={() => setMemberOpen(p)}>
                  <Users className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => openEdit(p)}>
                  Editar
                </Button>
                <Button size="sm" variant="ghost" onClick={() => remove(p)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {pastoralMembers(p.id).length} membro(s)
            </p>
          </div>
        ))}
        {pastorais.length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhuma pastoral cadastrada ainda.</p>
        )}
      </div>

      {/* Pastoral form */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Editar pastoral" : "Nova pastoral"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div>
              <Label>Cor</Label>
              <Input
                type="color"
                value={form.color}
                onChange={(e) => setForm({ ...form, color: e.target.value })}
                className="h-10 w-20"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={save}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Members dialog */}
      <Dialog open={!!memberOpen} onOpenChange={(o) => !o && setMemberOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Membros — {memberOpen?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              {memberOpen &&
                pastoralMembers(memberOpen.id).map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center justify-between rounded-md border bg-secondary/30 px-3 py-2 text-sm"
                  >
                    <div>
                      <span className="font-medium">{profileName(m.user_id)}</span>
                      <span className="ml-2 text-xs text-muted-foreground">
                        {m.role === "coordenador" ? "Coordenador(a)" : "Membro"}
                      </span>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => removeMember(m.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              {memberOpen && pastoralMembers(memberOpen.id).length === 0 && (
                <p className="text-xs text-muted-foreground">Nenhum membro ainda.</p>
              )}
            </div>
            <div className="rounded-md border p-3 space-y-2">
              <Label>Adicionar membro</Label>
              <Select
                value={newMember.user_id}
                onValueChange={(v) => setNewMember({ ...newMember, user_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um usuário" />
                </SelectTrigger>
                <SelectContent>
                  {profiles
                    .filter(
                      (p) => !memberOpen || !pastoralMembers(memberOpen.id).some((m) => m.user_id === p.id),
                    )
                    .map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.full_name ?? p.id.slice(0, 8)}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <Select
                value={newMember.role}
                onValueChange={(v) => setNewMember({ ...newMember, role: v as any })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="membro">Membro</SelectItem>
                  <SelectItem value="coordenador">Coordenador(a) da pastoral</SelectItem>
                </SelectContent>
              </Select>
              <Button size="sm" onClick={addMember} disabled={!newMember.user_id}>
                Adicionar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
