
-- 1. Table for per-model pricing (precio BN y Color)
CREATE TABLE public.precios_modelo (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  modelo TEXT NOT NULL UNIQUE,
  precio_bn NUMERIC(12,2) NOT NULL DEFAULT 0,
  precio_color NUMERIC(12,2) DEFAULT NULL,
  moneda TEXT NOT NULL DEFAULT 'gs',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- RLS for precios_modelo
ALTER TABLE public.precios_modelo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view precios_modelo"
  ON public.precios_modelo FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage precios_modelo"
  ON public.precios_modelo FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- 2. Table for repair costs (mano de obra)
CREATE TABLE public.costos_reparacion (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo_reparacion TEXT NOT NULL,
  costo NUMERIC(12,2) NOT NULL DEFAULT 0,
  moneda TEXT NOT NULL DEFAULT 'gs',
  descripcion TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- RLS for costos_reparacion
ALTER TABLE public.costos_reparacion ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view costos_reparacion"
  ON public.costos_reparacion FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage costos_reparacion"
  ON public.costos_reparacion FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- 3. Add IP fields to impresoras
ALTER TABLE public.impresoras
  ADD COLUMN lectura_ip BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN ip_address TEXT DEFAULT NULL;
