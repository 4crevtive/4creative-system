import { createFileRoute } from "@tanstack/react-router";
import { TasksKanban } from "@/components/tasks-kanban";

export const Route = createFileRoute("/_authenticated/agency/design")({
  component: () => <TasksKanban title="ديزاين الماركتنج" description="جميع مهام التصميم" filterType="design" />,
});