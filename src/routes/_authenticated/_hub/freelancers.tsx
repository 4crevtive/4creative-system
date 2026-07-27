import { createFileRoute } from "@tanstack/react-router";
import { FreelancersManager } from "@/components/freelancers-manager";

export const Route = createFileRoute("/_authenticated/_hub/freelancers")({
  head: () => ({ meta: [{ title: "الفريلانسرز — 4Creative" }] }),
  component: () => <FreelancersManager scopeFilter="all" defaultScope="both" title="الفريلانسرز" subtitle="إضافة وإدارة الفريلانسرز لكل من الاستوديو والأجنسي" />,
});
