import { createFileRoute } from "@tanstack/react-router";
import { AgencyClientsPage } from "@/components/agency/clients-page";

export const Route = createFileRoute("/_authenticated/agency/clients")({
  head: () => ({
    meta: [
      { title: "عملاء الماركتنج والبرمجة — 4Creative" },
      { name: "description", content: "قاعدة بيانات عملاء الوكالة مع بروفايل كل عميل، مشاريعه، ودخله." },
    ],
  }),
  component: AgencyClientsPage,
});
