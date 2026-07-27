import { createFileRoute } from "@tanstack/react-router";
import { TasksKanban } from "@/components/tasks-kanban";

export const Route = createFileRoute("/_authenticated/agency/montage")({
  component: () => <TasksKanban title="مونتاج الماركتنج" description="مهام المونتاج الخاصة بالوكالة" filterType="editing" />,
});