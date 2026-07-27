import { createFileRoute } from "@tanstack/react-router";
import { FinancePage } from "@/components/finance-page";

export const Route = createFileRoute("/_authenticated/reception/cashier")({
  head: () => ({ meta: [{ title: "الكاشير — الاستقبال — 4Creative" }] }),
  component: () => <FinancePage company="studio" title="كاشير الاستوديو" />,
});