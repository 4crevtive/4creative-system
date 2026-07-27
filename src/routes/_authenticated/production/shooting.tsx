import { createFileRoute } from "@tanstack/react-router";
import { MyTasksView } from "@/components/production/my-tasks-view";

export const Route = createFileRoute("/_authenticated/production/shooting")({
  head: () => ({ meta: [{ title: "تصوير — 4Creative" }] }),
  component: () => <MyTasksView taskType="shooting" title="داشبورد التصوير" subtitle="تاسكات التصوير المسندة إليك" />,
});