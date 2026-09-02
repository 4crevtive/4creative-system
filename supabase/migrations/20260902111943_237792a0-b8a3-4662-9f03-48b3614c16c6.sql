ALTER TABLE public.cash_movements
  ADD COLUMN IF NOT EXISTS agency_client_id uuid REFERENCES public.agency_clients(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS cash_movements_agency_client_id_idx
  ON public.cash_movements (agency_client_id);