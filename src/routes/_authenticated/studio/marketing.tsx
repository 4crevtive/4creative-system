import { createFileRoute } from "@tanstack/react-router";
import { TasksKanban } from "@/components/tasks-kanban";

export const Route = createFileRoute("/_authenticated/studio/marketing")({
  component: () => <TasksKanban title="تساكات الماركتنج" description="حملات وخطط التسويق" filterType="marketing" />,
});