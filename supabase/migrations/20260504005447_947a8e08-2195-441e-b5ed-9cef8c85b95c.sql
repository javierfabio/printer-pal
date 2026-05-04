CREATE TABLE IF NOT EXISTS public.user_permissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  can_view_impresoras    BOOLEAN NOT NULL DEFAULT true,
  can_create_impresoras  BOOLEAN NOT NULL DEFAULT false,
  can_edit_impresoras    BOOLEAN NOT NULL DEFAULT false,
  can_delete_impresoras  BOOLEAN NOT NULL DEFAULT false,
  can_view_lecturas      BOOLEAN NOT NULL DEFAULT true,
  can_create_lecturas    BOOLEAN NOT NULL DEFAULT true,
  can_delete_lecturas    BOOLEAN NOT NULL DEFAULT false,
  can_view_piezas        BOOLEAN NOT NULL DEFAULT true,
  can_edit_piezas        BOOLEAN NOT NULL DEFAULT false,
  can_view_costos        BOOLEAN NOT NULL DEFAULT false,
  can_edit_costos        BOOLEAN NOT NULL DEFAULT false,
  can_view_historial     BOOLEAN NOT NULL DEFAULT true,
  can_view_informes      BOOLEAN NOT NULL DEFAULT false,
  can_export_informes    BOOLEAN NOT NULL DEFAULT false,
  can_view_config        BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage user_permissions"
ON public.user_permissions
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can read own permissions"
ON public.user_permissions
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE TRIGGER update_user_permissions_updated_at
BEFORE UPDATE ON public.user_permissions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();