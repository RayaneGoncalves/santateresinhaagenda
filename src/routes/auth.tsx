import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Entrar — Agenda" }] }),
  component: AuthPage,
});

const emailSchema = z.string().trim().email("Email inválido").max(255);
const passwordSchema = z.string().min(6, "Mínimo 6 caracteres").max(72);
const nameSchema = z.string().trim().min(1, "Informe seu nome").max(80);

function AuthPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) navigate({ to: "/app" });
  }, [user, loading, navigate]);

  const [busy, setBusy] = useState(false);

  // Login
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // Signup
  const [name, setName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      emailSchema.parse(loginEmail);
      passwordSchema.parse(loginPassword);
      const { error } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password: loginPassword,
      });
      if (error) throw error;
      toast.success("Bem-vindo de volta!");
      navigate({ to: "/app" });
    } catch (err: any) {
      toast.error(err?.message ?? "Erro ao entrar");
    } finally {
      setBusy(false);
    }
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      nameSchema.parse(name);
      emailSchema.parse(signupEmail);
      passwordSchema.parse(signupPassword);
      const { error } = await supabase.auth.signUp({
        email: signupEmail,
        password: signupPassword,
        options: {
          emailRedirectTo: window.location.origin,
          data: { full_name: name },
        },
      });
      if (error) throw error;
      toast.success("Conta criada!");
      navigate({ to: "/app" });
    } catch (err: any) {
      toast.error(err?.message ?? "Erro ao criar conta");
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogle() {
    setBusy(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin + "/app",
    });
    if (result.error) {
      toast.error("Erro ao entrar com Google");
      setBusy(false);
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/app" });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-6 block text-center font-display text-3xl text-primary">
          Agenda
        </Link>
        <div className="rounded-2xl border bg-card p-6 shadow-[var(--shadow-soft)]">
          <Tabs defaultValue="login">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Entrar</TabsTrigger>
              <TabsTrigger value="signup">Criar conta</TabsTrigger>
            </TabsList>

            <TabsContent value="login" className="mt-4 space-y-4">
              <form onSubmit={handleLogin} className="space-y-3">
                <div>
                  <Label htmlFor="le">Email</Label>
                  <Input id="le" type="email" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} required />
                </div>
                <div>
                  <Label htmlFor="lp">Senha</Label>
                  <Input id="lp" type="password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} required />
                </div>
                <Button type="submit" className="w-full" disabled={busy}>
                  Entrar
                </Button>
              </form>
              <GoogleButton onClick={handleGoogle} disabled={busy} />
            </TabsContent>

            <TabsContent value="signup" className="mt-4 space-y-4">
              <form onSubmit={handleSignup} className="space-y-3">
                <div>
                  <Label htmlFor="sn">Nome</Label>
                  <Input id="sn" value={name} onChange={(e) => setName(e.target.value)} required />
                </div>
                <div>
                  <Label htmlFor="se">Email</Label>
                  <Input id="se" type="email" value={signupEmail} onChange={(e) => setSignupEmail(e.target.value)} required />
                </div>
                <div>
                  <Label htmlFor="sp">Senha</Label>
                  <Input id="sp" type="password" value={signupPassword} onChange={(e) => setSignupPassword(e.target.value)} required />
                </div>
                <Button type="submit" className="w-full" disabled={busy}>
                  Criar conta
                </Button>
              </form>
              <GoogleButton onClick={handleGoogle} disabled={busy} />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

function GoogleButton({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <>
      <div className="relative my-2 text-center text-xs text-muted-foreground">
        <span className="bg-card px-2 relative z-10">ou</span>
        <div className="absolute inset-x-0 top-1/2 -z-0 h-px bg-border" />
      </div>
      <Button type="button" variant="outline" className="w-full" onClick={onClick} disabled={disabled}>
        <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
          <path fill="#EA4335" d="M12 11v3.2h7.7c-.3 2-2.3 5.8-7.7 5.8-4.6 0-8.4-3.8-8.4-8.5S7.4 3 12 3c2.6 0 4.4 1.1 5.4 2.1l3-2.9C18.5.9 15.6 0 12 0 5.4 0 0 5.4 0 12s5.4 12 12 12c6.9 0 11.5-4.8 11.5-11.6 0-.8-.1-1.4-.2-2H12z"/>
        </svg>
        Continuar com Google
      </Button>
    </>
  );
}
