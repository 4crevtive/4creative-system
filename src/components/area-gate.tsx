import { useNavigate } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { useAllowedAreas, defaultLandingFor, type AreaKey } from "@/lib/use-allowed-areas";

export function AreaGate({ area, children }: { area: AreaKey; children: ReactNode }) {
  const navigate = useNavigate();
  const allowed = useAllowedAreas();

  useEffect(() => {
    if (allowed.isLoading) return;
    if (!allowed[area]) {
      navigate({ to: defaultLandingFor(allowed), replace: true });
    }
  }, [allowed, area, navigate]);

  if (allowed.isLoading || !allowed[area]) {
    return (
      <div className="min-h-screen grid place-items-center text-muted-foreground" dir="rtl">
        جارٍ التحقق من الصلاحيات...
      </div>
    );
  }
  return <>{children}</>;
}