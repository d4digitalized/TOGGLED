import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import NotificationsView from "@/components/NotificationsView";

export default async function NotificationsPage({
  params,
}: {
  params: Promise<{ wsId: string }>;
}) {
  await params; // layout ověřuje workspace; notifikace jsou osobní napříč ws
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return <NotificationsView userId={user.id} />;
}
