import { createFileRoute } from "@tanstack/react-router";
import { ConsolidatedFinance } from "@/components/admin/consolidated-finance";

export const Route = createFileRoute("/_authenticated/_hub/accounts")({
  head: () => ({ meta: [{ title: "الحسابات الشاملة — 4Creative" }] }),
  component: ConsolidatedFinance,
});