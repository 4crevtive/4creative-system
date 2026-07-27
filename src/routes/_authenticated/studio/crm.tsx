import { createFileRoute } from "@tanstack/react-router";
import { ContactsView } from "@/components/studio/contacts-view";

export const Route = createFileRoute("/_authenticated/studio/crm")({
  head: () => ({ meta: [{ title: "العملاء — 4Creative" }] }),
  component: () => <ContactsView />,
});
