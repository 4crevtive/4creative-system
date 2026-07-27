import { createFileRoute } from "@tanstack/react-router";
import { BookingsView } from "@/components/studio/bookings-view";

export const Route = createFileRoute("/_authenticated/reception/bookings")({
  head: () => ({ meta: [{ title: "الحجوزات — الاستقبال — 4Creative" }] }),
  component: () => <BookingsView title="الحجوزات والمواعيد" subtitle="إنشاء وتعديل حجوزات الغرف الثلاث" />,
});