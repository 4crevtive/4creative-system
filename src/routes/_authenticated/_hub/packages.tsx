import { createFileRoute } from "@tanstack/react-router";
import { PackagesManager } from "@/components/admin/packages-manager";

export const Route = createFileRoute("/_authenticated/_hub/packages")({
  head: () => ({
    meta: [
      { title: "الباقات والأسعار — إدارة 4Creative" },
      { name: "description", content: "إدارة كتالوج باقات الاستوديو: الصور، الأوصاف، الأسعار والساعات." },
      { property: "og:title", content: "الباقات والأسعار — إدارة 4Creative" },
      { property: "og:description", content: "إدارة كتالوج باقات الاستوديو المرتبط بالاستقبال." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PackagesManager,
});
