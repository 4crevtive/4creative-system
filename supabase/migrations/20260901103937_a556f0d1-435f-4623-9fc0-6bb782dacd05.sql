ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_contact_id_fkey;
ALTER TABLE public.payments ADD CONSTRAINT payments_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE SET NULL;

ALTER TABLE public.cash_movements DROP CONSTRAINT IF EXISTS cash_movements_contact_id_fkey;
ALTER TABLE public.cash_movements ADD CONSTRAINT cash_movements_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE SET NULL;

ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_contact_id_fkey;
ALTER TABLE public.tasks ADD CONSTRAINT tasks_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE SET NULL;

ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_contact_id_fkey;
ALTER TABLE public.invoices ADD CONSTRAINT invoices_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE CASCADE;

ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_contact_id_fkey;
ALTER TABLE public.bookings ADD CONSTRAINT bookings_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE CASCADE;

ALTER TABLE public.studio_packages DROP CONSTRAINT IF EXISTS studio_packages_contact_id_fkey;
ALTER TABLE public.studio_packages ADD CONSTRAINT studio_packages_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE CASCADE;

ALTER TABLE public.contact_history DROP CONSTRAINT IF EXISTS contact_history_contact_id_fkey;
ALTER TABLE public.contact_history ADD CONSTRAINT contact_history_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE CASCADE;