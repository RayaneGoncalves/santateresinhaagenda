import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Entrar — Agenda" }] }),
  component: AuthPage,
});

const emailSchema = z.string().trim().email("Email inválido").max(255);
const passwordSchema = z.string().min(6, "Mínimo 6 caracteres").max(72);

function AuthPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) navigate({ to: "/app" });
  }, [user, loading, navigate]);

  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"login" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      emailSchema.parse(email);
      passwordSchema.parse(password);
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      toast.success("Bem-vindo!");
      navigate({ to: "/app" });
    } catch (err: any) {
      toast.error(err?.message ?? "Erro ao entrar");
    } finally {
      setBusy(false);
    }
  }

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      emailSchema.parse(email);
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + "/reset-password",
      });
      if (error) throw error;
      toast.success("Se o e-mail existir, você receberá um link.");
      setMode("login");
    } catch (err: any) {
      toast.error(err?.message ?? "Erro");
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
        <div className="rounded-2xl border bg-card p-6 shadow-[var(--shadow-soft)] space-y-4">
          {mode === "login" ? (
            <form onSubmit={handleLogin} className="space-y-3">
              <h2 className="font-display text-xl">Entrar</h2>
              <p className="text-xs text-muted-foreground">
                O acesso é criado pelo administrador. Se ainda não recebeu, peça ao admin da paróquia.
              </p>
              <div>
                <Label htmlFor="le">Email</Label>
                <Input id="le" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div>
                <Label htmlFor="lp">Senha</Label>
                <Input id="lp" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
              </div>
              <Button type="submit" className="w-full" disabled={busy}>
                Entrar
              </Button>
              <button
                type="button"
                className="block w-full text-center text-xs text-muted-foreground underline"
                onClick={() => setMode("forgot")}
              >
                Esqueci minha senha
              </button>
            </form>
          ) : (
            <form onSubmit={handleForgot} className="space-y-3">
              <h2 className="font-display text-xl">Recuperar senha</h2>
              <div>
                <Label htmlFor="fe">Email</Label>
                <Input id="fe" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <Button type="submit" className="w-full" disabled={busy}>
                Enviar link
              </Button>
              <button
                type="button"
                className="block w-full text-center text-xs text-muted-foreground underline"
                onClick={() => setMode("login")}
              >
                Voltar
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
