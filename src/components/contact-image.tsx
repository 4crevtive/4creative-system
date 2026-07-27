import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Camera, Loader2 } from "lucide-react";

/**
 * Resolves a contact-media storage path (or full URL) to a displayable src.
 * - If value looks like a full http(s) url or data url, returns as-is.
 * - Otherwise, creates a signed URL for the private `contact-media` bucket.
 */
export function useContactImage(value: string | null | undefined) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    if (!value) { setSrc(null); return; }
    if (/^(https?:|data:|blob:)/i.test(value)) { setSrc(value); return; }
    supabase.storage.from("contact-media").createSignedUrl(value, 60 * 60 * 24 * 7)
      .then(({ data }) => { if (alive) setSrc(data?.signedUrl ?? null); });
    return () => { alive = false; };
  }, [value]);
  return src;
}

export async function uploadContactImage(
  contactId: string,
  file: File,
  kind: "avatar" | "cover",
): Promise<string> {
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const path = `${contactId}/${kind}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from("contact-media")
    .upload(path, file, { cacheControl: "3600", upsert: true, contentType: file.type });
  if (error) throw error;
  return path;
}

/**
 * Small upload button overlaid on avatar / cover. Handles file picking,
 * uploading to storage, updating the contact row, then invalidating.
 */
export function ImageUploadButton({
  contactId, kind, onUploaded, className, label,
}: {
  contactId: string;
  kind: "avatar" | "cover";
  onUploaded: (path: string) => void;
  className?: string;
  label?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("الحد الأقصى 5 ميجا"); return; }
    setBusy(true);
    try {
      const path = await uploadContactImage(contactId, file, kind);
      const col = kind === "avatar" ? "avatar_url" : "cover_url";
      const { error } = await supabase.from("contacts").update({ [col]: path } as never).eq("id", contactId);
      if (error) throw error;
      onUploaded(path);
      toast.success(kind === "avatar" ? "تم تحديث الصورة الشخصية" : "تم تحديث صورة الغلاف");
    } catch (err) {
      toast.error((err as Error).message || "فشل الرفع");
    } finally {
      setBusy(false);
      if (ref.current) ref.current.value = "";
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => ref.current?.click()}
        disabled={busy}
        className={className ?? "inline-flex items-center gap-1.5 rounded-full bg-background/90 backdrop-blur px-3 py-1.5 text-xs font-medium border shadow-sm hover:bg-background transition-colors disabled:opacity-60"}
      >
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
        {label ?? (kind === "avatar" ? "تغيير الصورة" : "تغيير الغلاف")}
      </button>
      <input ref={ref} type="file" accept="image/*" className="hidden" onChange={onPick} />
    </>
  );
}