-- Enum para estado de reparación
CREATE TYPE public.repair_status AS ENUM ('en_reparacion', 'resuelta', 'irreparable');

-- Tabla repair_history
CREATE TABLE public.repair_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  printer_id UUID NOT NULL REFERENCES public.impresoras(id) ON DELETE CASCADE,
  fecha_salida TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  motivo TEXT NOT NULL,
  tecnico_responsable TEXT,
  fecha_retorno TIMESTAMP WITH TIME ZONE,
  estado public.repair_status NOT NULL DEFAULT 'en_reparacion',
  costo_reparacion NUMERIC(12,2),
  moneda TEXT NOT NULL DEFAULT 'gs',
  resultado TEXT,
  notas TEXT,
  registrado_por UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX idx_repair_history_printer ON public.repair_history(printer_id);
CREATE INDEX idx_repair_history_estado ON public.repair_history(estado);
CREATE INDEX idx_repair_history_fecha_salida ON public.repair_history(fecha_salida DESC);

-- RLS
ALTER TABLE public.repair_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view repair_history"
ON public.repair_history FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated can insert repair_history"
ON public.repair_history FOR INSERT
TO authenticated
WITH CHECK (registrado_por = auth.uid());

CREATE POLICY "Authenticated can update repair_history"
ON public.repair_history FOR UPDATE
TO authenticated
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can delete repair_history"
ON public.repair_history FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger updated_at
CREATE TRIGGER update_repair_history_updated_at
BEFORE UPDATE ON public.repair_history
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();