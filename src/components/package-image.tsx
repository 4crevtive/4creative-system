import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Resolves a `package-images` storage path (or full URL) to a displayable src.
 */
export function usePackageImage(value: string | null | undefined) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    if (!value) { setSrc(null); return; }
    if (/^(https?:|data:|blob:)/i.test(value)) { setSrc(value); return; }
    supabase.storage.from("package-images").createSignedUrl(value, 60 * 60 * 24 * 7)
      .then(({ data }) => { if (alive) setSrc(data?.signedUrl ?? null); });
    return () => { alive = false; };
  }, [value]);
  return src;
}
