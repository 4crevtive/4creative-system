ALTER TABLE public.package_offerings
  ADD COLUMN IF NOT EXISTS room_id uuid REFERENCES public.rooms(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS package_offerings_room_id_idx ON public.package_offerings(room_id);