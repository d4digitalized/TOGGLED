import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import BoardView from "@/components/BoardView";

export default async function BoardPage({
  params,
}: {
  params: Promise<{ wsId: string; projectId: string }>;
}) {
  const { wsId, projectId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: project } = await supabase
    .from("projects")
    .select("id, name, workspace_id")
    .eq("id", projectId)
    .eq("workspace_id", wsId)
    .maybeSingle();
  if (!project) notFound();

  return (
    <BoardView wsId={wsId} projectId={projectId} projectName={project.name} userId={user!.id} />
  );
}
