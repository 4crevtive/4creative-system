import { Card } from "@/components/ui/card";
import type { ComponentType, ReactNode } from "react";

export function PagePlaceholder({
  title,
  description,
  icon: Icon,
  children,
}: {
  title: string;
  description?: string;
  icon?: ComponentType<{ className?: string }>;
  children?: ReactNode;
}) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        {Icon && (
          <div
            className="h-11 w-11 rounded-lg grid place-items-center text-primary-foreground"
            style={{ background: "var(--gradient-brand)" }}
          >
            <Icon className="h-5 w-5" />
          </div>
        )}
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{title}</h1>
          {description && <p className="text-muted-foreground text-sm mt-1">{description}</p>}
        </div>
      </div>
      {children ?? (
        <Card className="p-10 text-center text-muted-foreground">
          هذه الصفحة قيد التطوير — سيتم تفعيلها قريباً ضمن خارطة الطريق.
        </Card>
      )}
    </div>
  );
}