import { createFileRoute } from "@tanstack/react-router";
import { MyTasksView } from "@/components/production/my-tasks-view";

export const Route = createFileRoute("/_authenticated/production/design")({
  head: () => ({ meta: [{ title: "ديزاين — 4Creative" }] }),
  component: () => <MyTasksView taskType="design" title="داشبورد الديزاين" subtitle="تاسكات الديزاين المسندة إليك" />,
});