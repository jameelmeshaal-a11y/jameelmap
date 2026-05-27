import { redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export async function requireBrowserUser() {
  if (typeof window === "undefined") return null;

  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw redirect({ to: "/login" });

  return data.user;
}

export async function requireBrowserAdmin() {
  const user = await requireBrowserUser();
  if (!user) return null;

  const { data: role } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!role || role.role !== "admin") throw redirect({ to: "/" });

  return user;
}