import { createFileRoute } from "@tanstack/react-router";
import { TasksKanban } from "@/components/tasks-kanban";

export const Route = createFileRoute("/_authenticated/studio/design")({
  component: () => <TasksKanban title="ديزاين الاستوديو" description="تصاميم ثامنيلز والـ branding" filterType="design" />,
});