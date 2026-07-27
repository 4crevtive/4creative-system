import { createFileRoute } from "@tanstack/react-router";
import { ProjectWorkspace } from "@/components/agency/project-workspace";

export const Route = createFileRoute("/_authenticated/agency/projects/$id")({
  head: () => ({ meta: [{ title: "مساحة عمل المشروع — 4Creative" }] }),
  component: ProjectWorkspacePage,
});

function ProjectWorkspacePage() {
  const { id } = Route.useParams();
  return <ProjectWorkspace projectId={id} />;
}