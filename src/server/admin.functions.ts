import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Apenas administradores podem fazer isso.");
}

// Invite a new user — admin sends email + chooses initial role.
export const inviteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        email: z.string().trim().email().max(255),
        full_name: z.string().trim().min(1).max(120),
        role: z.enum(["user", "admin", "padre", "coordenacao", "coordenador"]).default("user"),
        redirect_to: z.string().url(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);

    const { data: invite, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(data.email, {
      redirectTo: data.redirect_to,
      data: { full_name: data.full_name },
    });
    if (error) throw new Error(error.message);
    const newUserId = invite.user?.id;
    if (!newUserId) throw new Error("Falha ao criar usuário.");

    // ensure profile (trigger usually creates it, but invite has no email confirmation flow)
    await supabaseAdmin
      .from("profiles")
      .upsert({ id: newUserId, full_name: data.full_name });

    if (data.role !== "user") {
      await supabaseAdmin.from("user_roles").insert({ user_id: newUserId, role: data.role });
    } else {
      await supabaseAdmin.from("user_roles").insert({ user_id: newUserId, role: "user" });
    }

    return { ok: true, user_id: newUserId };
  });

// Generate a password-recovery / setup link an admin can copy & share.
export const generateInviteLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        email: z.string().trim().email().max(255),
        full_name: z.string().trim().min(1).max(120),
        role: z.enum(["user", "admin", "padre", "coordenacao", "coordenador"]).default("user"),
        redirect_to: z.string().url(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);

    // 1. ensure user exists
    let userId: string | undefined;
    const { data: existing } = await supabaseAdmin.auth.admin.listUsers();
    const found = existing?.users.find((u) => u.email?.toLowerCase() === data.email.toLowerCase());
    if (found) {
      userId = found.id;
    } else {
      const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email: data.email,
        email_confirm: true,
        user_metadata: { full_name: data.full_name },
      });
      if (createErr) throw new Error(createErr.message);
      userId = created.user?.id;
    }
    if (!userId) throw new Error("Falha ao criar usuário.");

    await supabaseAdmin
      .from("profiles")
      .upsert({ id: userId, full_name: data.full_name });

    // assign role
    await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: userId, role: data.role }, { onConflict: "user_id,role" });

    // 2. generate recovery link
    const { data: link, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email: data.email,
      options: { redirectTo: data.redirect_to },
    });
    if (linkErr) throw new Error(linkErr.message);

    return { ok: true, action_link: link.properties?.action_link, user_id: userId };
  });

export const setUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        user_id: z.string().uuid(),
        role: z.enum(["user", "admin", "padre", "coordenacao", "coordenador"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    // remove existing global roles, set new one
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.user_id);
    const { error } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: data.user_id, role: data.role });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

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
    await assertAdmin(context.supabase, context.userId);
    const { data: link, error } = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email: data.email,
      options: { redirectTo: data.redirect_to },
    });
    if (error) throw new Error(error.message);
    return { ok: true, action_link: link.properties?.action_link };
  });

export const deleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ user_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    if (data.user_id === context.userId)
      throw new Error("Você não pode excluir sua própria conta.");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.user_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data: users } = await supabaseAdmin.auth.admin.listUsers();
    const { data: profiles } = await supabaseAdmin.from("profiles").select("id, full_name");
    const { data: roles } = await supabaseAdmin.from("user_roles").select("user_id, role");
    const profileMap = new Map(profiles?.map((p) => [p.id, p.full_name]) ?? []);
    const roleMap = new Map<string, string[]>();
    roles?.forEach((r) => {
      const arr = roleMap.get(r.user_id) ?? [];
      arr.push(r.role);
      roleMap.set(r.user_id, arr);
    });
    return (
      users?.users.map((u) => ({
        id: u.id,
        email: u.email,
        full_name: profileMap.get(u.id) ?? null,
        roles: roleMap.get(u.id) ?? ["user"],
        last_sign_in_at: u.last_sign_in_at,
      })) ?? []
    );
  });
