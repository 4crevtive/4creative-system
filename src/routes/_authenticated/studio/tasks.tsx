import { createFileRoute } from "@tanstack/react-router";
import { TasksKanban } from "@/components/tasks-kanban";

export const Route = createFileRoute("/_authenticated/studio/tasks")({
  component: () => <TasksKanban title="تساكات الاستوديو" description="تصوير · مونتاج · ديزاين" />,
});