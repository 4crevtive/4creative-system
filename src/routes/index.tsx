import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "4Creative — نظام الإدارة الداخلي" },
      { name: "description", content: "نقطة الدخول الرئيسية لنظام إدارة 4Creative الداخلي." },
      { property: "og:title", content: "4Creative — نظام الإدارة الداخلي" },
      { property: "og:description", content: "نقطة الدخول الرئيسية لنظام إدارة 4Creative الداخلي." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "4Creative — نظام الإدارة الداخلي" },
      { name: "twitter:description", content: "نقطة الدخول الرئيسية لنظام إدارة 4Creative الداخلي." },
    ],
  }),
  beforeLoad: () => {
    throw redirect({ to: "/dashboard" });
  },
});
