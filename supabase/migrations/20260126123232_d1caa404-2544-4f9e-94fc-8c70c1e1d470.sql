
-- Crear enum para roles de usuario
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- Crear enum para tipo de consumo
CREATE TYPE public.consumo_tipo AS ENUM ('tinta', 'toner');

-- Crear enum para tipo de impresión
CREATE TYPE public.impresion_tipo AS ENUM ('monocromatico', 'color');

-- Crear enum para estado de impresora
CREATE TYPE public.impresora_estado AS ENUM ('activa', 'inactiva', 'en_reparacion', 'baja');

-- Tabla de perfiles de usuario
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Tabla de roles de usuario (separada por seguridad)
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL DEFAULT 'user',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    UNIQUE (user_id, role)
);

-- Tabla de sectores/ubicaciones
CREATE TABLE public.sectores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre TEXT NOT NULL UNIQUE,
    descripcion TEXT,
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Tabla de filiales
CREATE TABLE public.filiales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre TEXT NOT NULL UNIQUE,
    direccion TEXT,
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Tabla principal de impresoras
CREATE TABLE public.impresoras (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    serie TEXT NOT NULL UNIQUE,
    nombre TEXT NOT NULL,
    modelo TEXT NOT NULL,
    tipo_consumo consumo_tipo NOT NULL,
    tipo_impresion impresion_tipo NOT NULL,
    sector_id UUID REFERENCES public.sectores(id),
    filial_id UUID REFERENCES public.filiales(id),
    contador_negro_inicial INTEGER DEFAULT 0,
    contador_color_inicial INTEGER DEFAULT 0,
    contador_negro_actual INTEGER DEFAULT 0,
    contador_color_actual INTEGER DEFAULT 0,
    fecha_registro TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    descripcion TEXT,
    estado impresora_estado DEFAULT 'activa' NOT NULL,
    editado_por UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Tabla de historial de cambios
CREATE TABLE public.historial_cambios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    impresora_id UUID REFERENCES public.impresoras(id) ON DELETE CASCADE NOT NULL,
    campo_modificado TEXT NOT NULL,
    valor_anterior TEXT,
    valor_nuevo TEXT,
    motivo TEXT,
    usuario_id UUID REFERENCES auth.users(id) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Tabla de lecturas de contadores
CREATE TABLE public.lecturas_contadores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    impresora_id UUID REFERENCES public.impresoras(id) ON DELETE CASCADE NOT NULL,
    contador_negro INTEGER,
    contador_color INTEGER,
    fecha_lectura TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    registrado_por UUID REFERENCES auth.users(id) NOT NULL,
    notas TEXT
);

-- Habilitar RLS en todas las tablas
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sectores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.filiales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.impresoras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.historial_cambios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lecturas_contadores ENABLE ROW LEVEL SECURITY;

-- Función para verificar rol
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.user_roles
        WHERE user_id = _user_id
          AND role = _role
    )
$$;

-- Función para obtener el rol del usuario actual
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS app_role
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT role
    FROM public.user_roles
    WHERE user_id = _user_id
    LIMIT 1
$$;

-- Políticas RLS para profiles
CREATE POLICY "Users can view all profiles" ON public.profiles
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE TO authenticated USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON public.profiles
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- Políticas RLS para user_roles (solo admin puede modificar)
CREATE POLICY "Users can view own role" ON public.user_roles
    FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert roles" ON public.user_roles
    FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update roles" ON public.user_roles
    FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Políticas para sectores y filiales (todos autenticados pueden ver, admin puede modificar)
CREATE POLICY "Anyone can view sectores" ON public.sectores
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage sectores" ON public.sectores
    FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Anyone can view filiales" ON public.filiales
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage filiales" ON public.filiales
    FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Políticas para impresoras
CREATE POLICY "Anyone can view impresoras" ON public.impresoras
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage impresoras" ON public.impresoras
    FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Políticas para historial_cambios
CREATE POLICY "Anyone can view historial" ON public.historial_cambios
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can insert historial" ON public.historial_cambios
    FOR INSERT TO authenticated WITH CHECK (usuario_id = auth.uid());

-- Políticas para lecturas_contadores (usuarios pueden registrar, todos pueden ver)
CREATE POLICY "Anyone can view lecturas" ON public.lecturas_contadores
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can insert lecturas" ON public.lecturas_contadores
    FOR INSERT TO authenticated WITH CHECK (registrado_por = auth.uid());

-- Trigger para crear perfil automáticamente
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name)
    VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name');
    
    -- Asignar rol de usuario por defecto
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'user');
    
    RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_impresoras_updated_at
    BEFORE UPDATE ON public.impresoras
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
