-- Create enum for part types
CREATE TYPE public.tipo_pieza AS ENUM ('toner_negro', 'toner_color', 'fusor', 'unidad_imagen', 'malla', 'transfer_belt', 'rodillo', 'otro');

-- Create parts table (tracks installed parts per printer)
CREATE TABLE public.piezas_impresora (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    impresora_id UUID NOT NULL REFERENCES public.impresoras(id) ON DELETE CASCADE,
    tipo_pieza tipo_pieza NOT NULL,
    nombre_pieza TEXT NOT NULL,
    vida_util_estimada INTEGER NOT NULL, -- Estimated lifespan in pages
    contador_instalacion INTEGER NOT NULL DEFAULT 0, -- Counter at installation
    paginas_consumidas INTEGER NOT NULL DEFAULT 0, -- Pages consumed since installation
    fecha_instalacion TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    activo BOOLEAN NOT NULL DEFAULT true,
    notas TEXT,
    instalado_por UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create parts change history table
CREATE TABLE public.historial_piezas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    impresora_id UUID NOT NULL REFERENCES public.impresoras(id) ON DELETE CASCADE,
    pieza_anterior_id UUID REFERENCES public.piezas_impresora(id),
    tipo_pieza tipo_pieza NOT NULL,
    nombre_pieza TEXT NOT NULL,
    contador_cambio INTEGER NOT NULL, -- Counter at moment of change
    vida_util_real INTEGER, -- Actual pages printed before replacement
    vida_util_estimada INTEGER NOT NULL,
    porcentaje_vida_consumida NUMERIC(5,2), -- % of estimated life used
    fecha_cambio TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    tecnico_id UUID REFERENCES auth.users(id),
    motivo TEXT,
    observaciones TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create parts configuration table (default lifespans)
CREATE TABLE public.configuracion_piezas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tipo_pieza tipo_pieza NOT NULL UNIQUE,
    nombre_display TEXT NOT NULL,
    vida_util_default INTEGER NOT NULL, -- Default lifespan in pages
    umbral_advertencia INTEGER NOT NULL DEFAULT 70, -- % for warning
    umbral_critico INTEGER NOT NULL DEFAULT 90, -- % for critical alert
    activo BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.piezas_impresora ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.historial_piezas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.configuracion_piezas ENABLE ROW LEVEL SECURITY;

-- RLS Policies for piezas_impresora
CREATE POLICY "Anyone can view piezas"
ON public.piezas_impresora
FOR SELECT
USING (true);

CREATE POLICY "Admins can manage piezas"
ON public.piezas_impresora
FOR ALL
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated can insert piezas"
ON public.piezas_impresora
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated can update piezas"
ON public.piezas_impresora
FOR UPDATE
USING (auth.uid() IS NOT NULL);

-- RLS Policies for historial_piezas
CREATE POLICY "Anyone can view historial_piezas"
ON public.historial_piezas
FOR SELECT
USING (true);

CREATE POLICY "Authenticated can insert historial_piezas"
ON public.historial_piezas
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- RLS Policies for configuracion_piezas
CREATE POLICY "Anyone can view configuracion_piezas"
ON public.configuracion_piezas
FOR SELECT
USING (true);

CREATE POLICY "Admins can manage configuracion_piezas"
ON public.configuracion_piezas
FOR ALL
USING (has_role(auth.uid(), 'admin'));

-- Insert default part configurations
INSERT INTO public.configuracion_piezas (tipo_pieza, nombre_display, vida_util_default, umbral_advertencia, umbral_critico)
VALUES
    ('toner_negro', 'Tóner Negro', 10000, 70, 90),
    ('toner_color', 'Tóner Color', 8000, 70, 90),
    ('fusor', 'Fusor', 100000, 80, 95),
    ('unidad_imagen', 'Unidad de Imagen', 50000, 75, 90),
    ('malla', 'Malla / Mesh', 60000, 75, 90),
    ('transfer_belt', 'Transfer Belt', 80000, 80, 95),
    ('rodillo', 'Rodillo', 75000, 80, 95),
    ('otro', 'Otra Pieza', 50000, 70, 90);

-- Create trigger for updated_at on piezas_impresora
CREATE TRIGGER update_piezas_impresora_updated_at
    BEFORE UPDATE ON public.piezas_impresora
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Create trigger for updated_at on configuracion_piezas
CREATE TRIGGER update_configuracion_piezas_updated_at
    BEFORE UPDATE ON public.configuracion_piezas
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();