import { createFileRoute } from "@tanstack/react-router";
import { MyTasksView } from "@/components/production/my-tasks-view";

export const Route = createFileRoute("/_authenticated/production/editing")({
  head: () => ({ meta: [{ title: "مونتاج — 4Creative" }] }),
  component: () => <MyTasksView taskType="editing" title="داشبورد المونتاج" subtitle="تاسكات المونتاج المسندة إليك" />,
});