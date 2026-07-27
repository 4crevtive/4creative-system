import { createFileRoute } from "@tanstack/react-router";
import { MyAdminTasks } from "@/components/admin/my-admin-tasks";

export const Route = createFileRoute("/_authenticated/_hub/my-tasks")({
  head: () => ({ meta: [{ title: "مهامي — 4Creative" }] }),
  component: MyAdminTasks,
});