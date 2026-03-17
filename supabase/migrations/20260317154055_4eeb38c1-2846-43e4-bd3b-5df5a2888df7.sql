
-- Create parts catalog table (piezas linked to printer models)
CREATE TABLE public.piezas_catalogo (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre_pieza TEXT NOT NULL,
  tipo_pieza TEXT NOT NULL,
  modelos_vinculados TEXT[] NOT NULL DEFAULT '{}',
  vida_util_estimada INTEGER NOT NULL DEFAULT 0,
  stock_actual INTEGER NOT NULL DEFAULT 0,
  fecha_ultima_carga TIMESTAMP WITH TIME ZONE,
  notas TEXT,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.piezas_catalogo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view piezas_catalogo" ON public.piezas_catalogo
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage piezas_catalogo" ON public.piezas_catalogo
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Trigger for updated_at
CREATE TRIGGER update_piezas_catalogo_updated_at
  BEFORE UPDATE ON public.piezas_catalogo
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Preload Ricoh parts from PDF data
-- Ricoh C6503 / C5100S (color MFP series)
INSERT INTO public.piezas_catalogo (nombre_pieza, tipo_pieza, modelos_vinculados, vida_util_estimada, stock_actual) VALUES
  ('Tóner Negro', 'toner_negro', ARRAY['C5100S','MP C6503'], 48500, 0),
  ('Tóner Amarillo', 'toner_color', ARRAY['C5100S','MP C6503'], 29000, 0),
  ('Tóner Magenta', 'toner_color', ARRAY['C5100S','MP C6503'], 29000, 0),
  ('Tóner Cyan', 'toner_color', ARRAY['C5100S','MP C6503'], 29000, 0),
  ('Cilindro (Drum)', 'unidad_imagen', ARRAY['C5100S','MP C6503'], 900000, 0),
  ('Cuchilla de Limpieza', 'otro', ARRAY['C5100S','MP C6503'], 300000, 0),
  ('Cinta de Transferencia', 'transfer_belt', ARRAY['C5100S','MP C6503'], 1200000, 0),
  ('Fusor', 'fusor', ARRAY['C5100S','MP C6503'], 300000, 0);

-- Ricoh IM400C (color laser)
INSERT INTO public.piezas_catalogo (nombre_pieza, tipo_pieza, modelos_vinculados, vida_util_estimada, stock_actual) VALUES
  ('Tóner Negro', 'toner_negro', ARRAY['IM400C'], 17400, 0),
  ('Tóner Color (CMY)', 'toner_color', ARRAY['IM400C'], 10500, 0),
  ('Unidad de Imagen', 'unidad_imagen', ARRAY['IM400C'], 60000, 0),
  ('Fusor', 'fusor', ARRAY['IM400C'], 120000, 0),
  ('Transfer Belt', 'transfer_belt', ARRAY['IM400C'], 100000, 0);

-- Ricoh IM2500 (mono)
INSERT INTO public.piezas_catalogo (nombre_pieza, tipo_pieza, modelos_vinculados, vida_util_estimada, stock_actual) VALUES
  ('Tóner Negro', 'toner_negro', ARRAY['IM2500'], 24000, 0),
  ('Unidad de Imagen (Drum)', 'unidad_imagen', ARRAY['IM2500'], 60000, 0),
  ('Fusor', 'fusor', ARRAY['IM2500'], 120000, 0);

-- Ricoh SP C840DN (color laser)
INSERT INTO public.piezas_catalogo (nombre_pieza, tipo_pieza, modelos_vinculados, vida_util_estimada, stock_actual) VALUES
  ('Tóner Negro', 'toner_negro', ARRAY['SP C840DN'], 43000, 0),
  ('Tóner Color (CMY)', 'toner_color', ARRAY['SP C840DN'], 34000, 0),
  ('Unidad de Imagen', 'unidad_imagen', ARRAY['SP C840DN'], 60000, 0),
  ('Fusor', 'fusor', ARRAY['SP C840DN'], 120000, 0),
  ('Transfer Belt', 'transfer_belt', ARRAY['SP C840DN'], 100000, 0);

-- Ricoh M5370LX (mono production)
INSERT INTO public.piezas_catalogo (nombre_pieza, tipo_pieza, modelos_vinculados, vida_util_estimada, stock_actual) VALUES
  ('Tóner Negro', 'toner_negro', ARRAY['M5370LX'], 43000, 0),
  ('Unidad de Imagen (Drum)', 'unidad_imagen', ARRAY['M5370LX'], 120000, 0),
  ('Fusor', 'fusor', ARRAY['M5370LX'], 200000, 0);
