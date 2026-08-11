import { createFileRoute } from "@tanstack/react-router";
import { AgencyClientProfile } from "@/components/agency/clients-page";

export const Route = createFileRoute("/_authenticated/agency/clients/$id")({
  head: () => ({
    meta: [
      { title: "بروفايل العميل — 4Creative" },
      { name: "description", content: "بيانات العميل، مشاريعه، الدخل والمصروفات المرتبطة به." },
    ],
  }),
  component: ClientProfilePage,
});

function ClientProfilePage() {
  const { id } = Route.useParams();
  return <AgencyClientProfile clientId={id} />;
}
