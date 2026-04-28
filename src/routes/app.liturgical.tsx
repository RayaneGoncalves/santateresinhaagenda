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
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { ChevronLeft, ChevronRight, Plus, Trash2, Church, Info, CalendarDays, List, Pencil } from "lucide-react";
import { LITURGICAL_COLORS, CELEBRATION_TYPES } from "@/lib/liturgical";

export const Route = createFileRoute("/app/liturgical")({
  component: LiturgicalPage,
});

type LiturgicalRow = {
  id: string;
  title: string;
  description: string | null;
  event_date: string;
  liturgical_color: string;
  celebration_type: string;
};

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function addMonths(d: Date, n: number) {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}
function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function LiturgicalPage() {
  const { user } = useAuth();
  const [cursor, setCursor] = useState(startOfMonth(new Date()));
  const [items, setItems] = useState<LiturgicalRow[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"calendar" | "list">("calendar");
  const [allItems, setAllItems] = useState<LiturgicalRow[]>([]);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<LiturgicalRow | null>(null);
  const [form, setForm] = useState({
    title: "",
    description: "",
    event_date: ymd(new Date()),
    liturgical_color: "verde",
    celebration_type: "memoria",
  });

  async function load() {
    setLoading(true);
    const start = startOfMonth(cursor);
    const end = addMonths(start, 1);
    const [{ data, error }, { data: yearData }] = await Promise.all([
      supabase
        .from("liturgical_events")
        .select("*")
        .gte("event_date", ymd(start))
        .lt("event_date", ymd(end))
        .order("event_date"),
      supabase
        .from("liturgical_events")
        .select("*")
        .gte("event_date", `${cursor.getFullYear()}-01-01`)
        .lte("event_date", `${cursor.getFullYear()}-12-31`)
        .order("event_date"),
    ]);
    if (error) toast.error(error.message);
    else setItems(data ?? []);
    setAllItems(yearData ?? []);

    if (user) {
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin");
      setIsAdmin((roles?.length ?? 0) > 0);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cursor.getTime(), user?.id]);

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

  const byDay = useMemo(() => {
    const map = new Map<string, LiturgicalRow[]>();
    items.forEach((it) => {
      const arr = map.get(it.event_date) ?? [];
      arr.push(it);
      map.set(it.event_date, arr);
    });
    return map;
  }, [items]);

  function openCreate(date?: Date) {
    if (!isAdmin) return;
    setEditing(null);
    setForm({
      title: "",
      description: "",
      event_date: ymd(date ?? new Date()),
      liturgical_color: "verde",
      celebration_type: "memoria",
    });
    setOpen(true);
  }
  function openEdit(it: LiturgicalRow) {
    if (!isAdmin) return;
    setEditing(it);
    setForm({
      title: it.title,
      description: it.description ?? "",
      event_date: it.event_date,
      liturgical_color: it.liturgical_color,
      celebration_type: it.celebration_type,
    });
    setOpen(true);
  }
  async function save() {
    if (!form.title.trim()) {
      toast.error("Título é obrigatório");
      return;
    }
    const payload = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      event_date: form.event_date,
      liturgical_color: form.liturgical_color,
      celebration_type: form.celebration_type,
    };
    if (editing) {
      const { error } = await supabase
        .from("liturgical_events")
        .update(payload)
        .eq("id", editing.id);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase.from("liturgical_events").insert(payload);
      if (error) return toast.error(error.message);
    }
    toast.success("Salvo");
    setOpen(false);
    load();
  }
  async function remove() {
    if (!editing) return;
    const { error } = await supabase.from("liturgical_events").delete().eq("id", editing.id);
    if (error) return toast.error(error.message);
    toast.success("Removido");
    setOpen(false);
    load();
  }

  const monthLabel = cursor.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  const weekDays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  const todayKey = ymd(new Date());

  return (
    <TooltipProvider delayDuration={150}>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Church className="h-6 w-6 text-primary" />
            <h1 className="font-display text-3xl text-foreground">Calendário Litúrgico</h1>
          </div>
          {isAdmin && (
            <Button onClick={() => openCreate(new Date())}>
              <Plus className="mr-2 h-4 w-4" />
              Nova celebração
            </Button>
          )}
        </div>

        {!isAdmin && (
          <div className="flex items-start gap-2 rounded-xl border bg-secondary/40 px-4 py-3 text-sm text-secondary-foreground">
            <Info className="h-4 w-4 mt-0.5 shrink-0" />
            <p>
              Este calendário é somente leitura. Apenas o pároco ou secretário (administrador) pode
              adicionar ou editar celebrações.
            </p>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => setCursor(addMonths(cursor, -1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="font-display text-xl capitalize min-w-[200px]">{monthLabel}</span>
            <Button variant="outline" size="icon" onClick={() => setCursor(addMonths(cursor, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="ghost" onClick={() => setCursor(startOfMonth(new Date()))}>
              Hoje
            </Button>
          </div>
          <div className="inline-flex rounded-lg border bg-card p-1">
            <Button
              variant={view === "calendar" ? "default" : "ghost"}
              size="sm"
              onClick={() => setView("calendar")}
            >
              <CalendarDays className="mr-2 h-4 w-4" />
              Calendário
            </Button>
            <Button
              variant={view === "list" ? "default" : "ghost"}
              size="sm"
              onClick={() => setView("list")}
            >
              <List className="mr-2 h-4 w-4" />
              Lista do ano
            </Button>
          </div>
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
              const dayItems = byDay.get(key) ?? [];
              const isToday = key === todayKey;
              return (
                <div
                  key={i}
                  onClick={() => isAdmin && openCreate(date)}
                  className={`min-h-[100px] border-b border-r p-2 text-left transition-colors ${
                    isAdmin ? "cursor-pointer hover:bg-accent/40" : ""
                  } ${inMonth ? "" : "bg-muted/30 text-muted-foreground"} ${
                    isToday ? "ring-2 ring-inset ring-ring/50" : ""
                  }`}
                >
                  <div className={`mb-1 text-sm font-semibold ${isToday ? "text-primary" : ""}`}>
                    {date.getDate()}
                  </div>
                  <div className="space-y-1">
                    {dayItems.map((it) => {
                      const meta = LITURGICAL_COLORS[it.liturgical_color] ?? LITURGICAL_COLORS.verde;
                      return (
                        <Tooltip key={it.id}>
                          <TooltipTrigger asChild>
                            <div
                              onClick={(ev) => {
                                ev.stopPropagation();
                                openEdit(it);
                              }}
                              className="truncate rounded-md border px-2 py-1 text-xs font-medium shadow-sm"
                              style={{
                                backgroundColor: meta.hex,
                                color: meta.textLight ? "#fff" : "#1a1a1a",
                                borderColor: meta.textLight ? "transparent" : "rgba(0,0,0,0.15)",
                              }}
                            >
                              {it.title}
                            </div>
                          </TooltipTrigger>
                          <TooltipContent
                            side="top"
                            className="max-w-xs space-y-1.5 bg-card text-card-foreground border shadow-lg p-3"
                          >
                            <div className="font-display text-sm font-semibold flex items-center gap-2">
                              <span
                                className="h-2.5 w-2.5 rounded-full border"
                                style={{ backgroundColor: meta.hex }}
                              />
                              {it.title}
                            </div>
                            <div className="text-[11px] text-muted-foreground">{meta.label}</div>
                            <div className="text-[11px] text-muted-foreground capitalize">
                              {
                                CELEBRATION_TYPES.find((t) => t.value === it.celebration_type)
                                  ?.label
                              }
                            </div>
                            {it.description && (
                              <p className="text-[11px] text-foreground/80 pt-1 border-t">
                                {it.description}
                              </p>
                            )}
                          </TooltipContent>
                        </Tooltip>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Legend */}
        <div className="rounded-2xl border bg-card p-4 shadow-[var(--shadow-card)]">
          <h2 className="font-display text-lg mb-3">Cores Litúrgicas</h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
            {Object.entries(LITURGICAL_COLORS).map(([key, c]) => (
              <div key={key} className="flex items-center gap-2 text-xs">
                <span
                  className="h-5 w-5 rounded-full border"
                  style={{ backgroundColor: c.hex }}
                />
                <span className="text-muted-foreground">{c.label}</span>
              </div>
            ))}
          </div>
        </div>

        {loading && <p className="text-center text-sm text-muted-foreground">Carregando…</p>}

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editing ? "Editar celebração" : "Nova celebração litúrgica"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Título</Label>
                <Input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                />
              </div>
              <div>
                <Label>Data</Label>
                <Input
                  type="date"
                  value={form.event_date}
                  onChange={(e) => setForm({ ...form, event_date: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Cor litúrgica</Label>
                  <Select
                    value={form.liturgical_color}
                    onValueChange={(v) => setForm({ ...form, liturgical_color: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(LITURGICAL_COLORS).map(([k, c]) => (
                        <SelectItem key={k} value={k}>
                          <span className="flex items-center gap-2">
                            <span
                              className="h-3 w-3 rounded-full border"
                              style={{ backgroundColor: c.hex }}
                            />
                            {c.label}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Tipo</Label>
                  <Select
                    value={form.celebration_type}
                    onValueChange={(v) => setForm({ ...form, celebration_type: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CELEBRATION_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Descrição</Label>
                <Textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter className="gap-2">
              {editing && (
                <Button variant="ghost" onClick={remove} className="mr-auto text-destructive">
                  <Trash2 className="mr-2 h-4 w-4" /> Excluir
                </Button>
              )}
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={save}>Salvar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
