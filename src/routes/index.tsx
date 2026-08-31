import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import heroImg from "@/assets/agenda-hero.jpg";
import { CalendarHeart, NotebookPen, Users } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Agenda — Sua rotina, com carinho" },
      { name: "description", content: "Calendário compartilhado e bloco de notas para organizar eventos e ideias." },
    ],
  }),
  component: Index,
});

function Index() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading) {
      navigate({ to: user ? "/app" : "/auth", replace: true });
    }
  }, [user, loading, navigate]);

  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <Link to="/" className="font-display text-2xl font-semibold text-primary">
          Agenda
        </Link>
        <nav className="flex items-center gap-3">
          <Link to="/auth">
            <Button>Entrar</Button>
          </Link>
        </nav>
      </header>

      <main>
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-6 py-16 md:grid-cols-2 md:py-24">
          <div>
            <span className="inline-flex items-center rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
              Calendário & Notas
            </span>
            <h1 className="mt-5 font-display text-5xl leading-tight text-foreground md:text-6xl">
              Organize sua rotina com leveza
            </h1>
            <p className="mt-5 max-w-lg text-lg text-muted-foreground">
              Marque eventos no calendário compartilhado e guarde suas ideias num bloco
              de notas pessoal — tudo num só lugar, com um toque acolhedor.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link to="/auth">
                <Button size="lg">Entrar com meu celular</Button>
              </Link>
              <p className="text-sm text-muted-foreground">
                Os acessos são criados pela secretaria da paróquia.
              </p>
            </div>
          </div>
          <div className="relative">
            <div
              className="absolute inset-0 -z-10 rounded-3xl"
              style={{ background: "var(--gradient-hero)" }}
            />
            <img
              src={heroImg}
              alt="Ilustração floral em aquarela com tons de bege e rosa"
              width={1280}
              height={896}
              className="rounded-3xl shadow-[var(--shadow-soft)]"
            />
          </div>
        </section>

        <section className="mx-auto grid max-w-6xl gap-6 px-6 pb-24 md:grid-cols-3">
          {[
            {
              icon: CalendarHeart,
              title: "Calendário interativo",
              desc: "Visões mensal, semanal e diária. Crie eventos com um clique.",
            },
            {
              icon: NotebookPen,
              title: "Bloco de notas",
              desc: "Anote ideias e vincule-as aos seus eventos quando quiser.",
            },
            {
              icon: Users,
              title: "Agenda compartilhada",
              desc: "Todos os usuários veem os eventos — perfeito para times.",
            },
          ].map(({ icon: Icon, title, desc }) => (
            <div
              key={title}
              className="rounded-2xl border bg-card p-6 shadow-[var(--shadow-card)]"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-secondary text-secondary-foreground">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 font-display text-xl">{title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{desc}</p>
            </div>
          ))}
        </section>
      </main>

      <footer className="border-t py-8 text-center text-sm text-muted-foreground">
        Feito com carinho ✿
      </footer>
    </div>
  );
}
