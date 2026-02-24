
-- Table for global and per-printer costs
CREATE TABLE public.costos_consumibles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo_pieza TEXT NOT NULL,
  impresora_id UUID REFERENCES public.impresoras(id) ON DELETE CASCADE,
  precio NUMERIC(12,2) NOT NULL DEFAULT 0,
  moneda TEXT NOT NULL DEFAULT 'ARS',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(tipo_pieza, impresora_id)
);

-- Global costs (impresora_id IS NULL)
CREATE UNIQUE INDEX idx_costos_global ON public.costos_consumibles (tipo_pieza) WHERE impresora_id IS NULL;

-- RLS
ALTER TABLE public.costos_consumibles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view costos" ON public.costos_consumibles
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage costos" ON public.costos_consumibles
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_costos_updated_at
  BEFORE UPDATE ON public.costos_consumibles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
