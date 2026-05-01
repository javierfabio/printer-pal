import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Loader2, Printer, Info, ClipboardList, Eye, EyeOff,
  CheckCircle2, ArrowLeft, AlertTriangle,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface PrinterInfo {
  id: string;
  nombre: string;
  modelo: string;
  serie: string;
  estado: string;
  tipo_consumo: string;
  tipo_impresion: string;
  contador_negro_actual: number;
  contador_color_actual: number;
  contador_negro_inicial: number;
  contador_color_inicial: number;
  filiales: { nombre: string } | null;
  sectores: { nombre: string } | null;
}

type Vista = 'inicio' | 'info' | 'login' | 'contador' | 'exito';

export default function ScanQR() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();

  const [printer, setPrinter] = useState<PrinterInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [vista, setVista] = useState<Vista>('inicio');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const [currentUser, setCurrentUser] = useState<any>(null);

  const [contadorNegro, setContadorNegro] = useState('');
  const [contadorColor, setContadorColor] = useState('');
  const [notas, setNotas] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    supabase
      .from('impresoras')
      .select('*, filiales(nombre), sectores(nombre)')
      .eq('id', id)
      .single()
      .then(({ data, error }) => {
        if (error || !data) setNotFound(true);
        else setPrinter(data as unknown as PrinterInfo);
        setLoading(false);
      });
  }, [id]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user) setCurrentUser(data.session.user);
    });
  }, []);

  const showBothCounters = printer?.tipo_consumo === 'toner' && printer?.tipo_impresion === 'color';
  const showOnlyBlack = printer?.tipo_impresion === 'monocromatico';
  const showOnlyColor = !showBothCounters && !showOnlyBlack;

  const totalActual = (printer?.contador_negro_actual || 0) + (printer?.contador_color_actual || 0);
  const totalInicial = (printer?.contador_negro_inicial || 0) + (printer?.contador_color_inicial || 0);
  const totalImpreso = totalActual - totalInicial;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError('');
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setAuthError('Email o contraseña incorrectos. Intentá nuevamente.');
      setAuthLoading(false);
      return;
    }
    setCurrentUser(data.user);
    setAuthLoading(false);
    setVista('contador');
  };

  const handleGuardar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!printer || !currentUser) return;

    const negroVal = parseInt(contadorNegro) || 0;
    const colorVal = parseInt(contadorColor) || 0;

    if ((showOnlyBlack || showBothCounters) && negroVal < printer.contador_negro_actual) {
      toast({ title: 'Error', description: `El contador B/N debe ser mayor o igual a ${printer.contador_negro_actual.toLocaleString()}`, variant: 'destructive' });
      return;
    }
    if ((showOnlyColor || showBothCounters) && colorVal < printer.contador_color_actual) {
      toast({ title: 'Error', description: `El contador Color debe ser mayor o igual a ${printer.contador_color_actual.toLocaleString()}`, variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      const { error: lecturaError } = await supabase.from('lecturas_contadores').insert({
        impresora_id: printer.id,
        contador_negro: (showOnlyBlack || showBothCounters) ? negroVal : null,
        contador_color: (showOnlyColor || showBothCounters) ? colorVal : null,
        notas: notas || null,
        registrado_por: currentUser.id,
        fecha_lectura: new Date().toISOString(),
      });
      if (lecturaError) throw lecturaError;

      const updates: Record<string, number> = {};
      if (showOnlyBlack || showBothCounters) updates.contador_negro_actual = negroVal;
      if (showOnlyColor || showBothCounters) updates.contador_color_actual = colorVal;

      const { error: updateError } = await supabase
        .from('impresoras')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', printer.id);
      if (updateError) throw updateError;

      setPrinter(prev => prev ? { ...prev, ...updates } as PrinterInfo : prev);
      setVista('exito');
    } catch {
      toast({ title: 'Error al guardar', description: 'No se pudo registrar la lectura. Intentá de nuevo.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Cargando impresora...</p>
      </div>
    </div>
  );

  if (notFound) return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="max-w-xs w-full text-center space-y-4">
        <div className="w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
          <AlertTriangle className="w-10 h-10 text-destructive" />
        </div>
        <h1 className="text-xl font-bold">QR no reconocido</h1>
        <p className="text-sm text-muted-foreground">
          Este código QR no corresponde a ninguna impresora registrada en el sistema.
        </p>
      </div>
    </div>
  );

  if (vista === 'inicio') return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="bg-primary px-6 pt-12 pb-8 text-primary-foreground">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-xl bg-primary-foreground/15">
            <Printer className="w-7 h-7" />
          </div>
          <div>
            <p className="text-xs text-primary-foreground/70 uppercase tracking-widest font-medium">PrintControl</p>
            <h1 className="text-xl font-bold leading-tight">{printer!.nombre}</h1>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-primary-foreground/10 rounded-xl px-3 py-2">
            <p className="text-xs text-primary-foreground/60">Modelo</p>
            <p className="text-sm font-semibold truncate">{printer!.modelo}</p>
          </div>
          <div className="bg-primary-foreground/10 rounded-xl px-3 py-2">
            <p className="text-xs text-primary-foreground/60">Estado</p>
            <p className="text-sm font-semibold capitalize">
              {printer!.estado === 'activa' ? '✅ Activa' : printer!.estado === 'en_reparacion' ? '🔧 Reparación' : printer!.estado}
            </p>
          </div>
          <div className="bg-primary-foreground/10 rounded-xl px-3 py-2">
            <p className="text-xs text-primary-foreground/60">Filial</p>
            <p className="text-sm font-semibold truncate">{printer!.filiales?.nombre || '—'}</p>
          </div>
          <div className="bg-primary-foreground/10 rounded-xl px-3 py-2">
            <p className="text-xs text-primary-foreground/60">Sector</p>
            <p className="text-sm font-semibold truncate">{printer!.sectores?.nombre || '—'}</p>
          </div>
        </div>
      </div>
      <div className="flex-1 flex flex-col justify-center px-6 gap-4 py-8">
        <p className="text-center text-sm text-muted-foreground mb-2">¿Qué querés hacer?</p>
        <button
          onClick={() => setVista('info')}
          className="w-full flex items-center gap-4 p-5 rounded-2xl border-2 border-border bg-card hover:border-primary hover:bg-primary/5 transition-all duration-200 text-left group"
        >
          <div className="w-12 h-12 rounded-xl bg-info/10 flex items-center justify-center group-hover:bg-info/20 transition-colors flex-shrink-0">
            <Info className="w-6 h-6 text-info" />
          </div>
          <div>
            <p className="font-semibold text-base">Ver información</p>
            <p className="text-sm text-muted-foreground mt-0.5">Modelo, sector, filial y contadores actuales</p>
          </div>
        </button>
        <button
          onClick={() => currentUser ? setVista('contador') : setVista('login')}
          className="w-full flex items-center gap-4 p-5 rounded-2xl border-2 border-border bg-card hover:border-primary hover:bg-primary/5 transition-all duration-200 text-left group"
        >
          <div className="w-12 h-12 rounded-xl bg-success/10 flex items-center justify-center group-hover:bg-success/20 transition-colors flex-shrink-0">
            <ClipboardList className="w-6 h-6 text-success" />
          </div>
          <div>
            <p className="font-semibold text-base">Cargar contador</p>
            <p className="text-sm text-muted-foreground mt-0.5">
              {currentUser ? 'Registrar nueva lectura de contadores' : 'Requiere usuario y contraseña'}
            </p>
          </div>
        </button>
        {currentUser && (
          <p className="text-center text-xs text-muted-foreground">Sesión activa: {currentUser.email}</p>
        )}
      </div>
      <div className="pb-8 text-center">
        <p className="text-xs text-muted-foreground">Serie: {printer!.serie}</p>
      </div>
    </div>
  );

  if (vista === 'info') return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="bg-card border-b px-4 py-4 flex items-center gap-3 sticky top-0 z-10">
        <button onClick={() => setVista('inicio')} className="p-2 rounded-lg hover:bg-muted transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="font-bold text-base leading-tight">{printer!.nombre}</h1>
          <p className="text-xs text-muted-foreground">{printer!.modelo}</p>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4">
        <div className="flex items-center justify-between p-4 rounded-2xl bg-card border">
          <span className="text-sm font-medium text-muted-foreground">Estado</span>
          <Badge
            className={
              printer!.estado === 'activa' ? 'bg-success/15 text-success border-success/30'
              : printer!.estado === 'en_reparacion' ? 'bg-warning/15 text-warning border-warning/30'
              : 'bg-muted text-muted-foreground'
            }
          >
            {printer!.estado === 'activa' ? 'Activa' : printer!.estado === 'en_reparacion' ? 'En Reparación' : printer!.estado}
          </Badge>
        </div>
        <div className="rounded-2xl bg-card border overflow-hidden">
          <div className="px-4 py-3 border-b bg-muted/30">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Información General</p>
          </div>
          {[
            { label: 'Modelo', value: printer!.modelo },
            { label: 'Número de serie', value: printer!.serie, mono: true },
            { label: 'Tipo de impresión', value: printer!.tipo_impresion },
            { label: 'Tipo de consumo', value: printer!.tipo_consumo },
          ].map((item, i) => (
            <div key={i} className={`flex items-center justify-between px-4 py-3 ${i < 3 ? 'border-b border-border/60' : ''}`}>
              <span className="text-sm text-muted-foreground">{item.label}</span>
              <span className={`text-sm font-medium capitalize ${item.mono ? 'font-mono text-xs' : ''}`}>{item.value}</span>
            </div>
          ))}
        </div>
        <div className="rounded-2xl bg-card border overflow-hidden">
          <div className="px-4 py-3 border-b bg-muted/30">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Ubicación</p>
          </div>
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/60">
            <span className="text-sm text-muted-foreground">Filial</span>
            <span className="text-sm font-medium">{printer!.filiales?.nombre || '—'}</span>
          </div>
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-sm text-muted-foreground">Sector</span>
            <span className="text-sm font-medium">{printer!.sectores?.nombre || '—'}</span>
          </div>
        </div>
        <div className="rounded-2xl bg-card border overflow-hidden">
          <div className="px-4 py-3 border-b bg-muted/30">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Contadores Actuales</p>
          </div>
          {(showBothCounters || showOnlyBlack) && (
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/60">
              <span className="text-sm text-muted-foreground">Blanco y Negro</span>
              <span className="text-sm font-bold tabular-nums">{printer!.contador_negro_actual.toLocaleString()}</span>
            </div>
          )}
          {(showBothCounters || showOnlyColor) && (
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-sm text-muted-foreground">Color</span>
              <span className="text-sm font-bold tabular-nums">{printer!.contador_color_actual.toLocaleString()}</span>
            </div>
          )}
        </div>
        <div className="rounded-2xl bg-primary/5 border border-primary/20 px-4 py-4">
          <p className="text-xs text-muted-foreground mb-1">Total páginas impresas (desde el registro)</p>
          <p className="text-2xl font-bold text-primary">
            {totalImpreso.toLocaleString()}
            <span className="text-sm font-normal text-muted-foreground ml-2">páginas</span>
          </p>
        </div>
      </div>
      <div className="px-4 pb-8 pt-3 border-t bg-background">
        <Button className="w-full h-12 text-base" onClick={() => currentUser ? setVista('contador') : setVista('login')}>
          <ClipboardList className="w-5 h-5 mr-2" />
          Cargar contador
        </Button>
      </div>
    </div>
  );

  if (vista === 'login') return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="bg-card border-b px-4 py-4 flex items-center gap-3 sticky top-0 z-10">
        <button onClick={() => setVista('inicio')} className="p-2 rounded-lg hover:bg-muted transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="font-bold text-base">Iniciar sesión</h1>
          <p className="text-xs text-muted-foreground">Para registrar la lectura</p>
        </div>
      </div>
      <div className="flex-1 px-6 pt-8 pb-6">
        <div className="flex items-center gap-3 p-4 rounded-2xl bg-primary/5 border border-primary/20 mb-8">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Printer className="w-5 h-5 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-sm truncate">{printer!.nombre}</p>
            <p className="text-xs text-muted-foreground truncate">{printer!.modelo} · {printer!.sectores?.nombre || '—'}</p>
          </div>
        </div>
        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-sm font-medium">Correo electrónico</Label>
            <Input id="email" type="email" placeholder="correo@ejemplo.com" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" className="h-12 text-base" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password" className="text-sm font-medium">Contraseña</Label>
            <div className="relative">
              <Input id="password" type={showPassword ? 'text' : 'password'} placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required autoComplete="current-password" className="h-12 text-base pr-12" />
              <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1">
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>
          {authError && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-sm">
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{authError}</span>
            </div>
          )}
          <Button type="submit" className="w-full h-12 text-base mt-2" disabled={authLoading}>
            {authLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Ingresando...</> : 'Ingresar'}
          </Button>
        </form>
      </div>
    </div>
  );

  if (vista === 'contador') return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="bg-card border-b px-4 py-4 flex items-center gap-3 sticky top-0 z-10">
        <button onClick={() => setVista('inicio')} className="p-2 rounded-lg hover:bg-muted transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="font-bold text-base">Registrar lectura</h1>
          <p className="text-xs text-muted-foreground">{printer!.nombre} · {printer!.serie}</p>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4">
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-muted/50 text-xs text-muted-foreground">
          <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs font-bold flex-shrink-0">
            {currentUser?.email?.[0]?.toUpperCase() || 'U'}
          </div>
          <span>Registrando como <strong>{currentUser?.email}</strong></span>
        </div>
        <div className="rounded-2xl bg-card border overflow-hidden">
          <div className="px-4 py-3 border-b bg-muted/30">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Contadores Actuales</p>
          </div>
          <div className={`grid ${showBothCounters ? 'grid-cols-2' : 'grid-cols-1'} divide-x`}>
            {(showBothCounters || showOnlyBlack) && (
              <div className="px-4 py-4 text-center">
                <p className="text-xs text-muted-foreground mb-1">Blanco y Negro</p>
                <p className="text-2xl font-bold tabular-nums">{printer!.contador_negro_actual.toLocaleString()}</p>
              </div>
            )}
            {(showBothCounters || showOnlyColor) && (
              <div className="px-4 py-4 text-center">
                <p className="text-xs text-muted-foreground mb-1">Color</p>
                <p className="text-2xl font-bold tabular-nums">{printer!.contador_color_actual.toLocaleString()}</p>
              </div>
            )}
          </div>
        </div>
        <form onSubmit={handleGuardar} className="space-y-4">
          {(showBothCounters || showOnlyBlack) && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Nuevo contador Blanco y Negro *</Label>
              <Input
                type="number"
                inputMode="numeric"
                min={printer!.contador_negro_actual}
                value={contadorNegro}
                onChange={e => setContadorNegro(e.target.value)}
                placeholder={`Mínimo: ${printer!.contador_negro_actual.toLocaleString()}`}
                required
                className="h-12 text-base tabular-nums"
                autoFocus
              />
              {contadorNegro && parseInt(contadorNegro) >= printer!.contador_negro_actual && (
                <p className="text-xs text-success font-medium">
                  + {(parseInt(contadorNegro) - printer!.contador_negro_actual).toLocaleString()} páginas este período
                </p>
              )}
            </div>
          )}
          {(showBothCounters || showOnlyColor) && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Nuevo contador Color *</Label>
              <Input
                type="number"
                inputMode="numeric"
                min={printer!.contador_color_actual}
                value={contadorColor}
                onChange={e => setContadorColor(e.target.value)}
                placeholder={`Mínimo: ${printer!.contador_color_actual.toLocaleString()}`}
                required={showOnlyColor || showBothCounters}
                className="h-12 text-base tabular-nums"
              />
              {contadorColor && parseInt(contadorColor) >= printer!.contador_color_actual && (
                <p className="text-xs text-success font-medium">
                  + {(parseInt(contadorColor) - printer!.contador_color_actual).toLocaleString()} páginas este período
                </p>
              )}
            </div>
          )}
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              Observaciones <span className="text-muted-foreground font-normal">(opcional)</span>
            </Label>
            <textarea
              value={notas}
              onChange={e => setNotas(e.target.value)}
              placeholder="Ej: Tóner reemplazado, papel atascado esta semana..."
              rows={3}
              maxLength={500}
              className="w-full px-3 py-2 text-sm rounded-lg border border-input bg-background resize-none focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <p className="text-xs text-muted-foreground text-right">{notas.length}/500</p>
          </div>
          <Button type="submit" className="w-full h-12 text-base" disabled={saving}>
            {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Guardando...</> : 'Guardar lectura'}
          </Button>
        </form>
      </div>
    </div>
  );

  if (vista === 'exito') return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      <div className="max-w-xs w-full text-center space-y-5">
        <div className="w-24 h-24 rounded-full bg-success/15 flex items-center justify-center mx-auto">
          <CheckCircle2 className="w-12 h-12 text-success" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">¡Lectura guardada!</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Los contadores de <strong>{printer!.nombre}</strong> fueron actualizados correctamente.
          </p>
        </div>
        <div className="rounded-2xl bg-card border p-4 text-left space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">Resumen</p>
          {(showBothCounters || showOnlyBlack) && contadorNegro && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">B/N actualizado</span>
              <span className="font-bold">{parseInt(contadorNegro).toLocaleString()}</span>
            </div>
          )}
          {(showBothCounters || showOnlyColor) && contadorColor && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Color actualizado</span>
              <span className="font-bold">{parseInt(contadorColor).toLocaleString()}</span>
            </div>
          )}
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Registrado</span>
            <span className="font-medium">
              {new Date().toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        </div>
        <div className="flex flex-col gap-2 w-full">
          <Button
            variant="outline"
            className="w-full"
            onClick={() => {
              setContadorNegro('');
              setContadorColor('');
              setNotas('');
              setVista('inicio');
            }}
          >
            Volver al inicio
          </Button>
        </div>
      </div>
    </div>
  );

  return null;
}