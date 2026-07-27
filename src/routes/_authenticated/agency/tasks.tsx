import { createFileRoute } from "@tanstack/react-router";
import { TasksKanban } from "@/components/tasks-kanban";

export const Route = createFileRoute("/_authenticated/agency/tasks")({
  component: () => <TasksKanban title="تساكات حسب الكاتجوري" description="جميع المهام بكافة الأنواع" />,
});