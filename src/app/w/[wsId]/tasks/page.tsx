import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import TasksView from "@/components/TasksView";

export default async function TasksPage({
  params,
}: {
  params: Promise<{ wsId: string }>;
}) {
  const { wsId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, { data: membership }] = await Promise.all([
    supabase.from("profiles").select("is_super_admin").eq("id", user.id).single(),
    supabase
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", wsId)
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);
  const isAdmin = (profile?.is_super_admin ?? false) || membership?.role === "admin";

  return <TasksView wsId={wsId} userId={user.id} isAdmin={isAdmin} />;
}
