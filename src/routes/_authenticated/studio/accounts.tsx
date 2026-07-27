import { createFileRoute } from "@tanstack/react-router";
import { FinancePage } from "@/components/finance-page";

export const Route = createFileRoute("/_authenticated/studio/accounts")({
  head: () => ({ meta: [{ title: "حسابات الاستوديو — 4Creative" }] }),
  component: () => <FinancePage company="studio" title="حسابات وخزنة الاستوديو" />,
});