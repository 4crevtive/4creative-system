import { createFileRoute } from "@tanstack/react-router";
import { TasksKanban } from "@/components/tasks-kanban";

export const Route = createFileRoute("/_authenticated/studio/montage")({
  component: () => <TasksKanban title="مونتاج الاستوديو" description="مهام مونتاج جلسات التصوير" filterType="editing" />,
});