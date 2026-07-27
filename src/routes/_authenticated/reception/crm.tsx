import { createFileRoute } from "@tanstack/react-router";
import { ContactsView } from "@/components/studio/contacts-view";

export const Route = createFileRoute("/_authenticated/reception/crm")({
  head: () => ({ meta: [{ title: "العملاء — الاستقبال — 4Creative" }] }),
  component: () => <ContactsView title="العملاء" subtitle="إضافة عملاء جدد ومتابعتهم" />,
});