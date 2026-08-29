import { createFileRoute, Outlet, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useUserRoles } from "@/lib/use-roles";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { LogOut, CalendarDays, NotebookPen, Church, Users, Shield, CheckSquare } from "lucide-react";

export const Route = createFileRoute("/app")({
  component: AppLayout,
});

function AppLayout() {
  const { user, loading, signOut } = useAuth();
  const { isAdmin, canApproveEvents } = useUserRoles();
  const navigate = useNavigate();
  const [mustChange, setMustChange] = useState<boolean | null>(null);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("must_change_password")
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        const flag = Boolean(data?.must_change_password);
        setMustChange(flag);
        if (flag) navigate({ to: "/definir-senha" });
      });
  }, [user, navigate]);

  if (loading || !user || mustChange === null || mustChange) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Carregando…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 md:px-6">
          <Link to="/app" className="font-display text-2xl font-semibold text-primary">
            Agenda
          </Link>
          <nav className="flex items-center gap-1">
            <Link to="/app">
              <Button variant="ghost" size="sm">
                <CalendarDays className="mr-2 h-4 w-4" />
                Calendário
              </Button>
            </Link>
            <Link to="/app/liturgical">
              <Button variant="ghost" size="sm">
                <Church className="mr-2 h-4 w-4" />
                Litúrgico
              </Button>
            </Link>
            <Link to="/app/notes">
              <Button variant="ghost" size="sm">
                <NotebookPen className="mr-2 h-4 w-4" />
                Notas
              </Button>
            </Link>
            {canApproveEvents && (
              <Link to="/app/aprovacoes">
                <Button variant="ghost" size="sm">
                  <CheckSquare className="mr-2 h-4 w-4" />
                  Aprovações
                </Button>
              </Link>
            )}
            {isAdmin && (
              <>
                <Link to="/app/pastorais">
                  <Button variant="ghost" size="sm">
                    <Users className="mr-2 h-4 w-4" />
                    Pastorais
                  </Button>
                </Link>
                <Link to="/app/usuarios">
                  <Button variant="ghost" size="sm">
                    <Shield className="mr-2 h-4 w-4" />
                    Usuários
                  </Button>
                </Link>
              </>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => {
                await signOut();
                navigate({ to: "/" });
              }}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sair
            </Button>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 md:px-6">
        <Outlet />
      </main>
    </div>
  );
}
