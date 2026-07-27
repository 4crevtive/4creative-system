import { createFileRoute } from "@tanstack/react-router";
import { TasksKanban } from "@/components/tasks-kanban";

export const Route = createFileRoute("/_authenticated/agency/photography")({
  component: () => <TasksKanban title="تصوير الماركتنج" description="جلسات التصوير الإعلاني" filterType="shooting" />,
});