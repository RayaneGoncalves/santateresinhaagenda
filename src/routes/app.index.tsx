import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Plus, Trash2, User as UserIcon, Tag, Clock, Check, X, Hourglass } from "lucide-react";
import { EVENT_CATEGORIES, categoryLabel } from "@/lib/liturgical";
import { useUserRoles } from "@/lib/use-roles";

export const Route = createFileRoute("/app/")({
  component: CalendarPage,
});

type EventRow = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  starts_at: string;
  ends_at: string;
  color: string;
  category: string;
  pastoral_id: string | null;
  status: "pendente" | "aprovado" | "rejeitado";
  approved_by: string | null;
};

type ProfileRow = { id: string; full_name: string | null };
type Pastoral = { id: string; name: string; color: string };
type Membership = { pastoral_id: string; role: "coordenador" | "membro" };

const COLORS = ["#c9847a", "#d4a574", "#a8c0a0", "#c17c74", "#8b6f5e", "#e2a9a0"];

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function addMonths(d: Date, n: number) {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}
function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function toLocalInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function CalendarPage() {
  const { user } = useAuth();
  const [cursor, setCursor] = useState(startOfMonth(new Date()));
  const [events, setEvents] = useState<EventRow[]>([]);
  const [profiles, setProfiles] = useState<Record<string, ProfileRow>>({});
  const [loading, setLoading] = useState(true);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<EventRow | null>(null);
  const [form, setForm] = useState({
    title: "",
    description: "",
    starts_at: toLocalInput(new Date()),
    ends_at: toLocalInput(new Date(Date.now() + 60 * 60 * 1000)),
    color: COLORS[0],
    category: "outro",
  });

  const monthStart = useMemo(() => startOfMonth(cursor), [cursor]);
  const monthEnd = useMemo(() => addMonths(monthStart, 1), [monthStart]);

  async function loadData() {
    setLoading(true);
    const { data, error } = await supabase
      .from("events")
      .select("*")
      .gte("starts_at", new Date(monthStart.getTime() - 7 * 86400000).toISOString())
      .lt("starts_at", new Date(monthEnd.getTime() + 7 * 86400000).toISOString())
      .order("starts_at");
    if (error) toast.error(error.message);
    else setEvents(data ?? []);

    const { data: profs } = await supabase.from("profiles").select("id, full_name");
    if (profs) {
      const map: Record<string, ProfileRow> = {};
      profs.forEach((p) => (map[p.id] = p));
      setProfiles(map);
    }
    setLoading(false);
  }

  useEffect(() => {
    loadData();
    const channel = supabase
      .channel("events-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "events" }, () => loadData())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthStart.getTime()]);

  const grid = useMemo(() => {
    const first = startOfMonth(cursor);
    const startWeekday = first.getDay();
    const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
    const cells: { date: Date; inMonth: boolean }[] = [];
    for (let i = startWeekday - 1; i >= 0; i--) {
      cells.push({
        date: new Date(cursor.getFullYear(), cursor.getMonth(), -i),
        inMonth: false,
      });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({ date: new Date(cursor.getFullYear(), cursor.getMonth(), d), inMonth: true });
    }
    while (cells.length % 7 !== 0 || cells.length < 42) {
      const last = cells[cells.length - 1].date;
      cells.push({
        date: new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1),
        inMonth: false,
      });
      if (cells.length >= 42) break;
    }
    return cells;
  }, [cursor]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, EventRow[]>();
    events.forEach((e) => {
      const key = ymd(new Date(e.starts_at));
      const arr = map.get(key) ?? [];
      arr.push(e);
      map.set(key, arr);
    });
    return map;
  }, [events]);

  function openCreate(date?: Date) {
    const base = date ?? new Date();
    base.setHours(9, 0, 0, 0);
    setEditing(null);
    setForm({
      title: "",
      description: "",
      starts_at: toLocalInput(base),
      ends_at: toLocalInput(new Date(base.getTime() + 60 * 60 * 1000)),
      color: COLORS[0],
      category: "outro",
    });
    setOpen(true);
  }

  function openEdit(ev: EventRow) {
    setEditing(ev);
    setForm({
      title: ev.title,
      description: ev.description ?? "",
      starts_at: toLocalInput(new Date(ev.starts_at)),
      ends_at: toLocalInput(new Date(ev.ends_at)),
      color: ev.color,
      category: ev.category ?? "outro",
    });
    setOpen(true);
  }

  async function save() {
    if (!user) return;
    if (!form.title.trim()) {
      toast.error("Título é obrigatório");
      return;
    }
    const payload = {
      title: form.title.trim().slice(0, 200),
      description: form.description.trim().slice(0, 2000) || null,
      starts_at: new Date(form.starts_at).toISOString(),
      ends_at: new Date(form.ends_at).toISOString(),
      color: form.color,
      category: form.category,
      user_id: user.id,
    };
    if (editing) {
      const { error } = await supabase.from("events").update(payload).eq("id", editing.id);
      if (error) return toast.error(error.message);
      toast.success("Evento atualizado");
    } else {
      const { error } = await supabase.from("events").insert(payload);
      if (error) return toast.error(error.message);
      toast.success("Evento criado");
    }
    setOpen(false);
    loadData();
  }

  async function remove() {
    if (!editing) return;
    const { error } = await supabase.from("events").delete().eq("id", editing.id);
    if (error) return toast.error(error.message);
    toast.success("Evento removido");
    setOpen(false);
    loadData();
  }

  const monthLabel = cursor.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  const weekDays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  const todayKey = ymd(new Date());

  return (
    <TooltipProvider delayDuration={150}>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => setCursor(addMonths(cursor, -1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h1 className="font-display text-3xl capitalize text-foreground min-w-[220px]">
              {monthLabel}
            </h1>
            <Button variant="outline" size="icon" onClick={() => setCursor(addMonths(cursor, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="ghost" onClick={() => setCursor(startOfMonth(new Date()))}>
              Hoje
            </Button>
          </div>
          <Button onClick={() => openCreate(new Date())}>
            <Plus className="mr-2 h-4 w-4" />
            Novo evento
          </Button>
        </div>

        <div className="rounded-2xl border bg-card shadow-[var(--shadow-card)] overflow-hidden">
          <div className="grid grid-cols-7 border-b bg-secondary/40 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {weekDays.map((w) => (
              <div key={w} className="px-2 py-2 text-center">
                {w}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {grid.map(({ date, inMonth }, i) => {
              const key = ymd(date);
              const dayEvents = eventsByDay.get(key) ?? [];
              const isToday = key === todayKey;
              return (
                <button
                  key={i}
                  onClick={() => openCreate(date)}
                  className={`min-h-[100px] border-b border-r p-2 text-left transition-colors hover:bg-accent/40 ${
                    inMonth ? "" : "bg-muted/30 text-muted-foreground"
                  } ${isToday ? "ring-2 ring-inset ring-ring/50" : ""}`}
                >
                  <div className={`mb-1 text-sm font-semibold ${isToday ? "text-primary" : ""}`}>
                    {date.getDate()}
                  </div>
                  <div className="space-y-1">
                    {dayEvents.slice(0, 3).map((e) => {
                      const author = profiles[e.user_id]?.full_name ?? "Usuário";
                      return (
                        <Tooltip key={e.id}>
                          <TooltipTrigger asChild>
                            <div
                              onClick={(ev) => {
                                ev.stopPropagation();
                                openEdit(e);
                              }}
                              className="truncate rounded-md px-2 py-1 text-xs font-medium text-white shadow-sm cursor-pointer"
                              style={{ backgroundColor: e.color }}
                            >
                              {e.title}
                            </div>
                          </TooltipTrigger>
                          <TooltipContent
                            side="top"
                            className="max-w-xs space-y-1.5 bg-card text-card-foreground border shadow-lg p-3"
                          >
                            <div className="font-display text-sm font-semibold flex items-center gap-2">
                              <span
                                className="h-2.5 w-2.5 rounded-full"
                                style={{ backgroundColor: e.color }}
                              />
                              {e.title}
                            </div>
                            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              {fmtDateTime(e.starts_at)} → {fmtDateTime(e.ends_at)}
                            </div>
                            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                              <UserIcon className="h-3 w-3" />
                              Agendado por <strong className="text-foreground">{author}</strong>
                            </div>
                            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                              <Tag className="h-3 w-3" />
                              {categoryLabel(e.category)}
                            </div>
                            {e.description && (
                              <p className="text-[11px] text-foreground/80 pt-1 border-t">
                                {e.description}
                              </p>
                            )}
                          </TooltipContent>
                        </Tooltip>
                      );
                    })}
                    {dayEvents.length > 3 && (
                      <div className="text-[10px] text-muted-foreground">
                        +{dayEvents.length - 3} mais
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {loading && <p className="text-center text-sm text-muted-foreground">Carregando…</p>}

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? "Editar evento" : "Novo evento"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Título</Label>
                <Input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  maxLength={200}
                />
              </div>
              <div>
                <Label>Tipo de evento</Label>
                <Select
                  value={form.category}
                  onValueChange={(v) => setForm({ ...form, category: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EVENT_CATEGORIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Descrição</Label>
                <Textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={3}
                  maxLength={2000}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Início</Label>
                  <Input
                    type="datetime-local"
                    value={form.starts_at}
                    onChange={(e) => setForm({ ...form, starts_at: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Fim</Label>
                  <Input
                    type="datetime-local"
                    value={form.ends_at}
                    onChange={(e) => setForm({ ...form, ends_at: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <Label>Cor</Label>
                <div className="mt-2 flex gap-2">
                  {COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setForm({ ...form, color: c })}
                      className={`h-8 w-8 rounded-full border-2 transition-transform ${
                        form.color === c ? "scale-110 border-foreground" : "border-transparent"
                      }`}
                      style={{ backgroundColor: c }}
                      aria-label={`Cor ${c}`}
                    />
                  ))}
                </div>
              </div>
              {editing && editing.user_id !== user?.id && (
                <p className="text-xs text-muted-foreground">
                  Criado por outro usuário — você não pode editar.
                </p>
              )}
            </div>
            <DialogFooter className="gap-2">
              {editing && editing.user_id === user?.id && (
                <Button variant="ghost" onClick={remove} className="mr-auto text-destructive">
                  <Trash2 className="mr-2 h-4 w-4" /> Excluir
                </Button>
              )}
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              {(!editing || editing.user_id === user?.id) && (
                <Button onClick={save}>Salvar</Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
