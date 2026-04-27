import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";

export const Route = createFileRoute("/app/notes")({
  head: () => ({ meta: [{ title: "Notas — Agenda" }] }),
  component: NotesPage,
});

type Note = {
  id: string;
  title: string;
  content: string;
  event_id: string | null;
  updated_at: string;
};

type EventLite = { id: string; title: string };

function NotesPage() {
  const { user } = useAuth();
  const [notes, setNotes] = useState<Note[]>([]);
  const [events, setEvents] = useState<EventLite[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const [notesRes, eventsRes] = await Promise.all([
      supabase.from("notes").select("*").order("updated_at", { ascending: false }),
      supabase.from("events").select("id, title").eq("user_id", user!.id).order("starts_at", { ascending: false }),
    ]);
    if (notesRes.error) toast.error(notesRes.error.message);
    else {
      setNotes(notesRes.data ?? []);
      if (!activeId && notesRes.data?.length) setActiveId(notesRes.data[0].id);
    }
    if (eventsRes.data) setEvents(eventsRes.data);
    setLoading(false);
  }

  useEffect(() => {
    if (user) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const active = notes.find((n) => n.id === activeId) ?? null;

  async function createNote() {
    if (!user) return;
    const { data, error } = await supabase
      .from("notes")
      .insert({ user_id: user.id, title: "Nova nota", content: "" })
      .select()
      .single();
    if (error) return toast.error(error.message);
    setNotes((p) => [data as Note, ...p]);
    setActiveId(data!.id);
  }

  async function updateActive(patch: Partial<Note>) {
    if (!active) return;
    setNotes((p) => p.map((n) => (n.id === active.id ? { ...n, ...patch } : n)));
    const { error } = await supabase.from("notes").update(patch).eq("id", active.id);
    if (error) toast.error(error.message);
  }

  async function removeActive() {
    if (!active) return;
    const { error } = await supabase.from("notes").delete().eq("id", active.id);
    if (error) return toast.error(error.message);
    setNotes((p) => p.filter((n) => n.id !== active.id));
    setActiveId(notes[0]?.id ?? null);
    toast.success("Nota removida");
  }

  return (
    <div className="grid h-[calc(100vh-7rem)] grid-cols-1 gap-4 md:grid-cols-[280px_1fr]">
      <aside className="rounded-2xl border bg-card p-3 shadow-[var(--shadow-card)]">
        <Button onClick={createNote} className="w-full" size="sm">
          <Plus className="mr-2 h-4 w-4" />
          Nova nota
        </Button>
        <div className="mt-3 space-y-1 overflow-y-auto">
          {loading && <p className="p-3 text-sm text-muted-foreground">Carregando…</p>}
          {!loading && notes.length === 0 && (
            <p className="p-3 text-sm text-muted-foreground">
              Nenhuma nota ainda. Crie a primeira!
            </p>
          )}
          {notes.map((n) => (
            <button
              key={n.id}
              onClick={() => setActiveId(n.id)}
              className={`w-full rounded-lg px-3 py-2 text-left transition-colors ${
                activeId === n.id ? "bg-secondary text-secondary-foreground" : "hover:bg-accent/40"
              }`}
            >
              <div className="truncate text-sm font-medium">{n.title || "Sem título"}</div>
              <div className="truncate text-xs text-muted-foreground">
                {n.content || "Vazio"}
              </div>
            </button>
          ))}
        </div>
      </aside>

      <section className="rounded-2xl border bg-card p-5 shadow-[var(--shadow-card)]">
        {!active ? (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            Selecione ou crie uma nota
          </div>
        ) : (
          <div className="flex h-full flex-col gap-3">
            <div className="flex items-center gap-2">
              <Input
                value={active.title}
                onChange={(e) => updateActive({ title: e.target.value.slice(0, 120) })}
                placeholder="Título"
                className="font-display text-lg"
              />
              <Button variant="ghost" size="icon" onClick={removeActive}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>

            <div>
              <Select
                value={active.event_id ?? "none"}
                onValueChange={(v) =>
                  updateActive({ event_id: v === "none" ? null : v })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Vincular a um evento (opcional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem evento</SelectItem>
                  {events.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Textarea
              value={active.content}
              onChange={(e) => updateActive({ content: e.target.value.slice(0, 10000) })}
              placeholder="Escreva suas ideias…"
              className="min-h-0 flex-1 resize-none"
            />
          </div>
        )}
      </section>
    </div>
  );
}
