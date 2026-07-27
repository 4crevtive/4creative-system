import { createFileRoute } from "@tanstack/react-router";
import { TasksKanban } from "@/components/tasks-kanban";

export const Route = createFileRoute("/_authenticated/agency/programming")({
  component: () => <TasksKanban title="مهام البرمجة" description="مشاريع البرمجة وتطوير المواقع والأنظمة" filterType="programming" />,
});