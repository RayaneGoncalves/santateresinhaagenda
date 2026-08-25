import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { normalizePhone, phoneToLoginEmail } from "@/lib/phone";

const roleEnum = z.enum(["user", "admin", "padre", "coordenacao", "coordenador"]);

/**
 * Cria o acesso de uma pessoa usando apenas nome + celular.
 * Gera uma senha temporária que o admin envia por WhatsApp — sem custo de SMS.
 * A pessoa é obrigada a definir a própria senha no primeiro acesso.
 */
export const createAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        full_name: z.string().trim().min(1).max(120),
        phone: z.string().trim().min(8).max(25),
        role: roleEnum.default("user"),
        pastoral_id: z.string().uuid().nullable().optional(),
        pastoral_role: z.enum(["coordenador", "membro"]).default("membro"),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { assertAdmin, generateTempPassword } = await import("./admin.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await assertAdmin(context.supabase, context.userId);

    const phone = normalizePhone(data.phone);
    if (!phone) throw new Error("Celular inválido. Use DDD + número, ex.: (11) 99999-8888.");

    const loginEmail = phoneToLoginEmail(phone);
    const tempPassword = generateTempPassword();

    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email: loginEmail,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { full_name: data.full_name, phone },
    });

    if (createErr) {
      const msg = createErr.message.toLowerCase();
      if (msg.includes("already") || msg.includes("registered") || msg.includes("exists")) {
        throw new Error("Já existe um acesso com esse celular. Use 'Gerar nova senha' na lista.");
      }
      throw new Error(createErr.message);
    }

    const userId = created.user?.id;
    if (!userId) throw new Error("Falha ao criar o acesso.");

    await supabaseAdmin.from("profiles").upsert({
      id: userId,
      full_name: data.full_name,
      phone,
      must_change_password: true,
    });

    // papel global — o trigger já cria 'user'; garantimos o papel escolhido
    await supabaseAdmin.from("user_roles").delete().eq("user_id", userId);
    const { error: roleErr } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: userId, role: data.role });
    if (roleErr) throw new Error(roleErr.message);

    // vínculo opcional com uma pastoral
    if (data.pastoral_id) {
      const { error: memberErr } = await supabaseAdmin.from("pastoral_members").insert({
        pastoral_id: data.pastoral_id,
        user_id: userId,
        role: data.pastoral_role,
      });
      if (memberErr) throw new Error(memberErr.message);
    }

    return { ok: true, user_id: userId, phone, temp_password: tempPassword };
  });

/** Gera uma nova senha temporária para quem esqueceu ou perdeu a senha. */
export const resetTempPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ user_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { assertAdmin, generateTempPassword } = await import("./admin.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await assertAdmin(context.supabase, context.userId);

    const tempPassword = generateTempPassword();
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.user_id, {
      password: tempPassword,
    });
    if (error) throw new Error(error.message);

    await supabaseAdmin
      .from("profiles")
      .update({ must_change_password: true })
      .eq("id", data.user_id);

    return { ok: true, temp_password: tempPassword };
  });

export const setUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ user_id: z.string().uuid(), role: roleEnum }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { assertAdmin } = await import("./admin.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await assertAdmin(context.supabase, context.userId);
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.user_id);
    const { error } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: data.user_id, role: data.role });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ user_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { assertAdmin } = await import("./admin.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await assertAdmin(context.supabase, context.userId);
    if (data.user_id === context.userId)
      throw new Error("Você não pode excluir sua própria conta.");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.user_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Link de recuperação — só faz sentido para os acessos criados com e-mail real. */
export const regenerateInviteLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        email: z.string().trim().email().max(255),
        redirect_to: z.string().url(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { assertAdmin } = await import("./admin.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await assertAdmin(context.supabase, context.userId);
    const { data: link, error } = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email: data.email,
      options: { redirectTo: data.redirect_to },
    });
    if (error) throw new Error(error.message);
    return { ok: true, action_link: link.properties?.action_link };
  });

export const listUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertAdmin } = await import("./admin.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await assertAdmin(context.supabase, context.userId);

    const { data: users } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, phone, must_change_password");
    const { data: roles } = await supabaseAdmin.from("user_roles").select("user_id, role");
    const { data: members } = await supabaseAdmin
      .from("pastoral_members")
      .select("user_id, role, pastorais(name)");

    const profileMap = new Map(profiles?.map((p) => [p.id, p]) ?? []);
    const roleMap = new Map<string, string[]>();
    roles?.forEach((r) => {
      const arr = roleMap.get(r.user_id) ?? [];
      arr.push(r.role);
      roleMap.set(r.user_id, arr);
    });
    const pastoralMap = new Map<string, { name: string; role: string }[]>();
    members?.forEach((m) => {
      const name = (m as unknown as { pastorais: { name: string } | null }).pastorais?.name;
      if (!name) return;
      const arr = pastoralMap.get(m.user_id) ?? [];
      arr.push({ name, role: m.role });
      pastoralMap.set(m.user_id, arr);
    });

    return (
      users?.users.map((u) => {
        const profile = profileMap.get(u.id);
        return {
          id: u.id,
          email: u.email ?? null,
          full_name: profile?.full_name ?? null,
          phone: profile?.phone ?? null,
          must_change_password: profile?.must_change_password ?? false,
          roles: roleMap.get(u.id) ?? ["user"],
          pastorais: pastoralMap.get(u.id) ?? [],
          last_sign_in_at: u.last_sign_in_at ?? null,
        };
      }) ?? []
    );
  });
