import { createFileRoute } from "@tanstack/react-router";
import { FinancePage } from "@/components/finance-page";

export const Route = createFileRoute("/_authenticated/agency/accounts")({
  head: () => ({ meta: [{ title: "حسابات الوكالة — 4Creative" }] }),
  component: () => <FinancePage company="agency" title="حسابات وخزنة الوكالة" />,
});