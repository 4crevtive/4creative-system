import { createFileRoute } from "@tanstack/react-router";
import { BookingsView } from "@/components/studio/bookings-view";

export const Route = createFileRoute("/_authenticated/studio/bookings")({
  head: () => ({ meta: [{ title: "الحجوزات — 4Creative" }] }),
  component: () => <BookingsView />,
});
