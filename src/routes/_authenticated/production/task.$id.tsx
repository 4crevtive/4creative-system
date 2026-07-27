import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { TaskDetailView } from "@/components/production/task-detail-view";

export const Route = createFileRoute("/_authenticated/production/task/$id")({
  head: () => ({ meta: [{ title: "تفاصيل التاسك — 4Creative" }] }),
  component: TaskDetailPage,
});

function TaskDetailPage() {
  const { id } = Route.useParams();
  return (
    <div className="space-y-4" dir="rtl">
      <Button asChild variant="ghost" size="sm">
        <Link to="/production"><ArrowRight className="h-4 w-4 ml-1" /> رجوع</Link>
      </Button>
      <TaskDetailView id={id} />
    </div>
  );
}