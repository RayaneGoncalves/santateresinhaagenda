import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/definir-senha")({
  head: () => ({
    meta: [
      { title: "Criar sua senha — Agenda Paroquial" },
      {
        name: "description",
        content: "Defina a sua senha pessoal para começar a usar a agenda da paróquia.",
      },
    ],
  }),
  component: DefinirSenhaPage,
});

function DefinirSenhaPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [user, loading, navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) return toast.error("A senha precisa ter pelo menos 6 caracteres");
    if (password !== confirm) return toast.error("As duas senhas não são iguais");

    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        toast.error(error.message);
        return;
      }
      if (user) {
        await supabase
          .from("profiles")
          .update({ must_change_password: false })
          .eq("id", user.id);
      }
      toast.success("Senha criada! Bem-vindo(a).");
      navigate({ to: "/app" });
    } finally {
      setBusy(false);
    }
  }

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Carregando…
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <form
        onSubmit={submit}
        className="w-full max-w-md space-y-4 rounded-2xl border bg-card p-6 shadow-[var(--shadow-soft)]"
      >
        <div>
          <h1 className="font-display text-2xl text-primary">Crie a sua senha</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Você entrou com a senha temporária da paróquia. Escolha agora uma senha só sua.
          </p>
        </div>
        <div>
          <Label htmlFor="np">Nova senha</Label>
          <Input
            id="np"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <div>
          <Label htmlFor="cp">Repita a nova senha</Label>
          <Input
            id="cp"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
          />
        </div>
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? "Salvando…" : "Salvar senha e entrar"}
        </Button>
      </form>
    </div>
  );
}
