import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Resolves a stored avatar/cover path (or full URL) to a displayable src.
 * If the value already looks like an http(s) URL it is returned as-is.
 * Otherwise a fresh signed URL is minted from the private "avatars" bucket.
 */
export function useAvatarSrc(pathOrUrl: string | null | undefined): string | null {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    if (!pathOrUrl) { setSrc(null); return; }
    if (/^https?:\/\//i.test(pathOrUrl)) { setSrc(pathOrUrl); return; }
    supabase.storage.from("avatars").createSignedUrl(pathOrUrl, 60 * 60).then(({ data }) => {
      if (alive) setSrc(data?.signedUrl ?? null);
    });
    return () => { alive = false; };
  }, [pathOrUrl]);
  return src;
}