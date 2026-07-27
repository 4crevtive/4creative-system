import { createFileRoute } from "@tanstack/react-router";
import { TasksKanban } from "@/components/tasks-kanban";

export const Route = createFileRoute("/_authenticated/studio/photography")({
  component: () => <TasksKanban title="تساكات التصوير" description="جلسات وتغطيات التصوير" filterType="shooting" />,
});