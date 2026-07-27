import { createFileRoute } from "@tanstack/react-router";
import { AgencyProjectsPage } from "@/components/agency/projects-page";

export const Route = createFileRoute("/_authenticated/agency/projects")({
  head: () => ({ meta: [{ title: "مشاريع الوكالة — 4Creative" }] }),
  component: AgencyProjectsPage,
});