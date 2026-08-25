import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { resolveLoginIdentifier } from "@/lib/phone";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar — Agenda Paroquial" },
      {
        name: "description",
        content:
          "Acesse a agenda da paróquia com seu celular e senha. Os acessos são criados pela administração.",
      },
      { property: "og:title", content: "Entrar — Agenda Paroquial" },
      {
        property: "og:description",
        content: "Acesse a agenda da paróquia com seu celular e senha.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) navigate({ to: "/app" });
  }, [user, loading, navigate]);

  const [busy, setBusy] = useState(false);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    const email = resolveLoginIdentifier(identifier);
    if (!email) {
      toast.error("Digite seu celular com DDD, ex.: (11) 99999-8888");
      return;
    }
    if (!password) {
      toast.error("Digite sua senha");
      return;
    }

    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        toast.error(
          error.message.toLowerCase().includes("invalid")
            ? "Celular ou senha incorretos. Confira os dados que a paróquia enviou."
            : error.message,
        );
        return;
      }
      toast.success("Bem-vindo(a)!");
      navigate({ to: "/app" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-6 block text-center font-display text-3xl text-primary">
          Agenda Paroquial
        </Link>
        <div className="space-y-4 rounded-2xl border bg-card p-6 shadow-[var(--shadow-soft)]">
          <form onSubmit={handleLogin} className="space-y-3">
            <h1 className="font-display text-xl">Entrar</h1>
            <div>
              <Label htmlFor="identifier">Celular</Label>
              <Input
                id="identifier"
                inputMode="tel"
                autoComplete="username"
                placeholder="(11) 99999-8888"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "Entrando…" : "Entrar"}
            </Button>
          </form>

          <div className="rounded-xl bg-secondary/40 p-3 text-xs text-muted-foreground">
            <p className="font-medium text-foreground">Primeiro acesso?</p>
            <p className="mt-1">
              Use o celular e a senha temporária que a paróquia enviou. O sistema vai pedir para você
              criar sua própria senha.
            </p>
            <p className="mt-2">
              Esqueceu a senha? Fale com a secretaria ou coordenação — eles geram uma nova senha
              temporária na hora.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
