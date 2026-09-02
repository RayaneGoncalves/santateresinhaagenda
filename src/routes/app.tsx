import { createFileRoute, Outlet, useNavigate, Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useUserRoles } from "@/lib/use-roles";
import { supabase } from "@/integrations/supabase/client";
import { LogOut, CalendarDays, NotebookPen, Church, Users, Shield, CheckSquare } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";

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
    <SidebarProvider>
      <AppSidebar
        isAdmin={isAdmin}
        canApproveEvents={canApproveEvents}
        onSignOut={async () => {
          await signOut();
          navigate({ to: "/" });
        }}
      />
      <SidebarInset className="min-w-0">
        <header className="sticky top-0 z-30 grid h-14 grid-cols-[auto_minmax(0,1fr)] items-center gap-3 border-b bg-background/90 px-4 backdrop-blur md:px-6">
          <SidebarTrigger className="h-9 w-9" />
          <h1 className="truncate font-display text-lg font-semibold text-foreground md:text-xl">
            Agenda Paroquial
          </h1>
        </header>
        <main className="w-full min-w-0 flex-1 px-3 py-4 sm:px-4 md:px-6 md:py-6">
          <div className="mx-auto w-full max-w-7xl">
            <Outlet />
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}

type AppSidebarProps = {
  isAdmin: boolean;
  canApproveEvents: boolean;
  onSignOut: () => Promise<void>;
};

function AppSidebar({ isAdmin, canApproveEvents, onSignOut }: AppSidebarProps) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const { isMobile, setOpenMobile } = useSidebar();

  const closeMobileMenu = () => {
    if (isMobile) setOpenMobile(false);
  };

  const items = ([
    { label: "Calendário", to: "/app", icon: CalendarDays, visible: true },
    { label: "Calendário litúrgico", to: "/app/liturgical", icon: Church, visible: true },
    { label: "Notas", to: "/app/notes", icon: NotebookPen, visible: true },
    { label: "Aprovações", to: "/app/aprovacoes", icon: CheckSquare, visible: canApproveEvents },
    { label: "Pastorais", to: "/app/pastorais", icon: Users, visible: isAdmin },
    { label: "Usuários", to: "/app/usuarios", icon: Shield, visible: isAdmin },
  ] as const).filter((item) => item.visible);

  return (
    <Sidebar side="left" collapsible="icon">
      <SidebarHeader className="border-b p-3">
        <Link
          to="/app"
          onClick={closeMobileMenu}
          className="flex h-10 min-w-0 items-center gap-3 overflow-hidden px-1 text-primary"
        >
          <Church className="h-6 w-6 shrink-0" />
          <span className="truncate font-display text-xl font-semibold group-data-[collapsible=icon]:hidden">
            Santa Teresinha
          </span>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navegação</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
                const active =
                  item.to === "/app" ? pathname === "/app" || pathname === "/app/" : pathname === item.to;
                return (
                  <SidebarMenuItem key={item.to}>
                    <SidebarMenuButton asChild isActive={active} tooltip={item.label} size="lg">
                      <Link to={item.to} onClick={closeMobileMenu}>
                        <item.icon />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton tooltip="Sair" size="lg" onClick={onSignOut}>
              <LogOut />
              <span>Sair</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
