import { createFileRoute } from "@tanstack/react-router";
import { ActivityLog } from "@/components/admin/activity-log";

export const Route = createFileRoute("/_authenticated/_hub/activity")({
  head: () => ({
    meta: [
      { title: "سجل النشاط — إدارة 4Creative" },
      {
        name: "description",
        content: "سجل كامل لكل إضافة أو تعديل أو حذف في النظام ومن نفّذه من الأدمن والمديرين.",
      },
      { property: "og:title", content: "سجل النشاط — إدارة 4Creative" },
      { property: "og:description", content: "تتبع كل تغيير في النظام مع اسم المسؤول ووقت التنفيذ." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ActivityLog,
});
