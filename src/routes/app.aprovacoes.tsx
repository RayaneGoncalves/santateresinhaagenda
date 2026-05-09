import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useUserRoles } from "@/lib/use-roles";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Check, X, Clock } from "lucide-react";

export const Route = createFileRoute("/app/aprovacoes")({
  component: AprovacoesPage,
});

type EventRow = {
  id: string;
  title: string;
  description: string | null;
  starts_at: string;
  ends_at: string;
  status: "pendente" | "aprovado" | "rejeitado";
  user_id: string;
  pastoral_id: string | null;
  approved_at: string | null;
  approved_by: string | null;
  rejected_at: string | null;
  rejected_by: string | null;
  rejection_reason: string | null;
};

type Pastoral = { id: string; name: string; color: string };
type Profile = { id: string; full_name: string | null };

function fmt(dt: string) {
  return new Date(dt).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function AprovacoesPage() {
  const { user } = useAuth();
  const { canApproveEvents, loading: rolesLoading } = useUserRoles();
  const [events, setEvents] = useState<EventRow[]>([]);
  const [pastorais, setPastorais] = useState<Pastoral[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [filter, setFilter] = useState<"pendente" | "todos">("pendente");
  const [rejectOpen, setRejectOpen] = useState<EventRow | null>(null);
  const [reason, setReason] = useState("");

  async function load() {
    const [{ data: e }, { data: p }, { data: pr }] = await Promise.all([
      supabase
        .from("events")
        .select("*")
        .order("starts_at", { ascending: false })
        .limit(200),
      supabase.from("pastorais").select("id, name, color"),
      supabase.from("profiles").select("id, full_name"),
    ]);
    setEvents((e ?? []) as EventRow[]);
    setPastorais(p ?? []);
    setProfiles(pr ?? []);
  }

  useEffect(() => {
    if (canApproveEvents) load();
  }, [canApproveEvents]);

  async function approve(ev: EventRow) {
    const { error } = await supabase
      .from("events")
      .update({
        status: "aprovado",
        approved_at: new Date().toISOString(),
        approved_by: user!.id,
        rejected_at: null,
        rejected_by: null,
        rejection_reason: null,
      })
      .eq("id", ev.id);
    if (error) return toast.error(error.message);
    toast.success("Evento aprovado");
    load();
  }

  async function confirmReject() {
    if (!rejectOpen) return;
    const { error } = await supabase
      .from("events")
      .update({
        status: "rejeitado",
        rejected_at: new Date().toISOString(),
        rejected_by: user!.id,
        rejection_reason: reason.trim() || null,
        approved_at: null,
        approved_by: null,
      })
      .eq("id", rejectOpen.id);
    if (error) return toast.error(error.message);
    toast.success("Evento rejeitado");
    setRejectOpen(null);
    setReason("");
    load();
  }

  if (rolesLoading) return <p className="text-muted-foreground">Carregando…</p>;
  if (!canApproveEvents)
    return (
      <p className="rounded-xl border bg-card p-6 text-muted-foreground">
        Apenas Padre, Coordenação ou Administradores podem aprovar eventos.
      </p>
    );

  const visible = events.filter((e) => (filter === "pendente" ? e.status === "pendente" : true));
  const pastoralOf = (id: string | null) => pastorais.find((p) => p.id === id);
  const nameOf = (id: string | null) =>
    id ? profiles.find((p) => p.id === id)?.full_name ?? "—" : "—";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl">Aprovações</h1>
          <p className="text-sm text-muted-foreground">
            Eventos aguardando análise dos coordenadores.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant={filter === "pendente" ? "default" : "outline"}
            onClick={() => setFilter("pendente")}
          >
            Pendentes ({events.filter((e) => e.status === "pendente").length})
          </Button>
          <Button
            size="sm"
            variant={filter === "todos" ? "default" : "outline"}
            onClick={() => setFilter("todos")}
          >
            Todos
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        {visible.length === 0 && (
          <div className="rounded-xl border bg-card p-6 text-center text-sm text-muted-foreground">
            Nenhum evento {filter === "pendente" ? "pendente" : ""}.
          </div>
        )}
        {visible.map((ev) => {
          const past = pastoralOf(ev.pastoral_id);
          return (
            <div
              key={ev.id}
              className="rounded-2xl border bg-card p-4 shadow-[var(--shadow-card)]"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-display text-lg">{ev.title}</h3>
                    {ev.status === "pendente" && (
                      <Badge variant="outline" className="gap-1">
                        <Clock className="h-3 w-3" /> Pendente
                      </Badge>
                    )}
                    {ev.status === "aprovado" && (
                      <Badge className="bg-emerald-600 hover:bg-emerald-600">Aprovado</Badge>
                    )}
                    {ev.status === "rejeitado" && (
                      <Badge variant="destructive">Rejeitado</Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {fmt(ev.starts_at)} → {fmt(ev.ends_at)}
                  </p>
                  {past && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span
                        className="inline-block h-3 w-3 rounded-full"
                        style={{ backgroundColor: past.color }}
                      />
                      {past.name}
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Solicitado por: {nameOf(ev.user_id)}
                  </p>
                  {ev.description && <p className="text-sm">{ev.description}</p>}
                  {ev.status === "aprovado" && ev.approved_by && (
                    <p className="text-xs text-emerald-700">
                      Aprovado por {nameOf(ev.approved_by)} em{" "}
                      {ev.approved_at && fmt(ev.approved_at)}
                    </p>
                  )}
                  {ev.status === "rejeitado" && (
                    <div className="text-xs text-destructive">
                      Rejeitado por {nameOf(ev.rejected_by)}
                      {ev.rejected_at && ` em ${fmt(ev.rejected_at)}`}
                      {ev.rejection_reason && ` — "${ev.rejection_reason}"`}
                    </div>
                  )}
                </div>
                {ev.status !== "aprovado" && (
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => approve(ev)}>
                      <Check className="mr-1 h-4 w-4" /> Aprovar
                    </Button>
                    {ev.status !== "rejeitado" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setReason("");
                          setRejectOpen(ev);
                        }}
                      >
                        <X className="mr-1 h-4 w-4" /> Rejeitar
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <Dialog open={!!rejectOpen} onOpenChange={(o) => !o && setRejectOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rejeitar evento</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Informe o motivo (opcional) — ficará registrado no histórico.
            </p>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex.: conflito com outra celebração…"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={confirmReject}>
              Confirmar rejeição
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
