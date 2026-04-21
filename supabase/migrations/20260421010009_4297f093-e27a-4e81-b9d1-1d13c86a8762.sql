-- Tipo de movimiento
CREATE TYPE public.movimiento_stock_tipo AS ENUM ('entrada', 'salida');

CREATE TABLE public.movimientos_stock (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pieza_catalogo_id UUID NOT NULL REFERENCES public.piezas_catalogo(id) ON DELETE CASCADE,
  tipo_movimiento public.movimiento_stock_tipo NOT NULL,
  cantidad INTEGER NOT NULL CHECK (cantidad > 0),
  proveedor TEXT,
  numero_factura TEXT,
  precio_unitario NUMERIC,
  moneda TEXT NOT NULL DEFAULT 'gs',
  impresora_id UUID REFERENCES public.impresoras(id) ON DELETE SET NULL,
  motivo TEXT,
  notas TEXT,
  fecha_movimiento TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  registrado_por UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_movimientos_stock_pieza ON public.movimientos_stock(pieza_catalogo_id);
CREATE INDEX idx_movimientos_stock_fecha ON public.movimientos_stock(fecha_movimiento DESC);

ALTER TABLE public.movimientos_stock ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view movimientos_stock"
ON public.movimientos_stock FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can insert movimientos_stock"
ON public.movimientos_stock FOR INSERT TO authenticated
WITH CHECK (registrado_por = auth.uid());

CREATE POLICY "Admins can update movimientos_stock"
ON public.movimientos_stock FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete movimientos_stock"
ON public.movimientos_stock FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_movimientos_stock_updated_at
BEFORE UPDATE ON public.movimientos_stock
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger para auto-ajustar stock_actual en piezas_catalogo
CREATE OR REPLACE FUNCTION public.ajustar_stock_pieza()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.tipo_movimiento = 'entrada' THEN
    UPDATE public.piezas_catalogo
    SET stock_actual = stock_actual + NEW.cantidad,
        fecha_ultima_carga = NEW.fecha_movimiento,
        updated_at = now()
    WHERE id = NEW.pieza_catalogo_id;
  ELSIF NEW.tipo_movimiento = 'salida' THEN
    UPDATE public.piezas_catalogo
    SET stock_actual = GREATEST(0, stock_actual - NEW.cantidad),
        updated_at = now()
    WHERE id = NEW.pieza_catalogo_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_ajustar_stock_pieza
AFTER INSERT ON public.movimientos_stock
FOR EACH ROW EXECUTE FUNCTION public.ajustar_stock_pieza();