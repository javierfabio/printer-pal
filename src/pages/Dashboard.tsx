import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Printer, CheckCircle, Wrench, TrendingUp, Activity, FileText, BarChart3,
  ArrowUpRight, Clock, Package, AlertTriangle, FileWarning, DollarSign, ArrowUp, ArrowDown, Minus
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { TIPO_PIEZA_LABELS } from '@/hooks/usePartsAlerts';
import { DashboardCharts } from '@/components/dashboard/DashboardCharts';
import { usePartsAlertsContext } from '@/contexts/PartsAlertsContext';
import { FetchErrorState } from '@/components/ui/fetch-error-state';

interface Stats {
  total: number; activas: number; enReparacion: number; inactivas: number;
  totalPaginasNegro: number; totalPaginasColor: number; lecturasHoy: number;
  paginasMesActual: number; paginasMesAnterior: number;
  lecturasMes: number; lecturasMesAnterior: number;
  sinLecturaMes: number;
}

interface TopPrinter {
  id: string; nombre: string; modelo: string;
  contador_negro_actual: number; contador_color_actual: number; tipo_impresion: string;
}

interface RecentReading {
  id: string; fecha_lectura: string;
  contador_negro: number | null; contador_color: number | null;
  impresora_id: string;
  impresoras: { nombre: string; serie: string; modelo: string; sector_id: string | null; };
}

interface RepairOpen {
  id: string; printer_id: string; fecha_salida: string; motivo: string;
  tecnico_responsable: string | null;
  impresoras?: { nombre: string; serie: string; modelo: string };
}

interface Sector { id: string; nombre: string; }
interface Filial { id: string; nombre: string; }
interface PrinterFull {
  id: string;
  nombre: string;
  modelo: string;
  sector_id: string | null;
  filial_id: string | null;
  contador_negro_actual: number | null;
  contador_color_actual: number | null;
}
interface ReadingMin {
  id: string;
  impresora_id: string;
  fecha_lectura: string;
  contador_negro: number | null;
  contador_color: number | null;
}
interface NoReadingPrinter { id: string; nombre: string; modelo: string; serie: string; filial_id: string | null; sector_id: string | null; }

export default function Dashboard() {
  const { user, role } = useAuth();
  const navigate = useNavigate();
  const { alerts: piezasConAlerta } = usePartsAlertsContext();
  const [stats, setStats] = useState<Stats>({
    total: 0, activas: 0, enReparacion: 0, inactivas: 0,
    totalPaginasNegro: 0, totalPaginasColor: 0, lecturasHoy: 0,
    paginasMesActual: 0, paginasMesAnterior: 0,
    lecturasMes: 0, lecturasMesAnterior: 0,
    sinLecturaMes: 0,
  });
  const [topPrinters, setTopPrinters] = useState<TopPrinter[]>([]);
  const [recentReadings, setRecentReadings] = useState<RecentReading[]>([]);
  const [openRepairs, setOpenRepairs] = useState<RepairOpen[]>([]);
  const [sectores, setSectores] = useState<Sector[]>([]);
  const [filiales, setFiliales] = useState<Filial[]>([]);
  const [printers, setPrinters] = useState<PrinterFull[]>([]);
  const [chartReadings, setChartReadings] = useState<ReadingMin[]>([]);
  const [noReadingPrinters, setNoReadingPrinters] = useState<NoReadingPrinter[]>([]);
  const [showNoReadingPanel, setShowNoReadingPanel] = useState(false);
  const [modelosSinPrecio, setModelosSinPrecio] = useState<{ modelo: string; count: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const fetchData = async () => {
      setLoading(true);
      setFetchError(null);
      try {
      const [printersResp, readingsResp, secResp, filResp, repairsResp, allReadingsResp, preciosResp] = await Promise.all([
        supabase.from('impresoras').select('*'),
        supabase.from('lecturas_contadores')
          .select('*, impresoras(nombre, serie, modelo, sector_id)')
          .order('fecha_lectura', { ascending: false })
          .limit(15),
        supabase.from('sectores').select('id, nombre').eq('activo', true),
        supabase.from('filiales').select('id, nombre').eq('activo', true),
        supabase.from('repair_history')
          .select('id, printer_id, fecha_salida, motivo, tecnico_responsable, impresoras:printer_id(nombre, serie, modelo)')
          .eq('estado', 'en_reparacion')
          .order('fecha_salida', { ascending: false }),
        supabase.from('lecturas_contadores').select('impresora_id'),
        supabase.from('precios_modelo').select('modelo'),
      ]);

      // Lecturas para gráfico mensual (últimos 6 meses)
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      const chartReadingsResp = await supabase
        .from('lecturas_contadores')
        .select('id, impresora_id, fecha_lectura, contador_negro, contador_color')
        .gte('fecha_lectura', sixMonthsAgo.toISOString())
        .order('fecha_lectura', { ascending: true });
      if (chartReadingsResp.data) setChartReadings(chartReadingsResp.data as ReadingMin[]);

      if (repairsResp.data) setOpenRepairs(repairsResp.data as any);

      if (secResp.data) setSectores(secResp.data);
      if (filResp.data) setFiliales(filResp.data);

      if (printersResp.data) {
        const p = printersResp.data;
        setPrinters(p.map(x => ({
          id: x.id,
          nombre: x.nombre,
          modelo: x.modelo,
          sector_id: x.sector_id,
          filial_id: x.filial_id,
          contador_negro_actual: x.contador_negro_actual,
          contador_color_actual: x.contador_color_actual,
        })));
        // Impresoras sin lecturas
        const idsConLectura = new Set((allReadingsResp.data || []).map((r: any) => r.impresora_id));
        const currentMonthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
        const idsConLecturaMes = new Set((chartReadingsResp.data || [])
          .filter((r: any) => new Date(r.fecha_lectura) >= currentMonthStart)
          .map((r: any) => r.impresora_id));
        const sinLectura = p
          .filter(x => !idsConLectura.has(x.id) && x.estado !== 'baja')
          .map(x => ({ id: x.id, nombre: x.nombre, modelo: x.modelo, serie: x.serie, filial_id: x.filial_id, sector_id: x.sector_id }));
        setNoReadingPrinters(sinLectura);
        // Modelos sin precio
        const preciosSet = new Set((preciosResp.data || []).map((x: any) => x.modelo));
        const modelosCount: Record<string, number> = {};
        p.filter(x => x.estado === 'activa').forEach(x => {
          if (!preciosSet.has(x.modelo)) modelosCount[x.modelo] = (modelosCount[x.modelo] || 0) + 1;
        });
        setModelosSinPrecio(Object.entries(modelosCount).map(([modelo, count]) => ({ modelo, count })).sort((a, b) => b.count - a.count));

        const totalNegro = p.reduce((acc, x) => acc + (x.contador_negro_actual || 0) - (x.contador_negro_inicial || 0), 0);
        const totalColor = p.reduce((acc, x) => acc + (x.contador_color_actual || 0) - (x.contador_color_inicial || 0), 0);
        setStats({
          total: p.length,
          activas: p.filter(x => x.estado === 'activa').length,
          enReparacion: p.filter(x => x.estado === 'en_reparacion').length,
          inactivas: p.filter(x => x.estado === 'inactiva' || x.estado === 'baja').length,
          totalPaginasNegro: totalNegro, totalPaginasColor: totalColor,
          lecturasHoy: 0,
          paginasMesActual: 0, paginasMesAnterior: 0,
          lecturasMes: 0, lecturasMesAnterior: 0,
          sinLecturaMes: p.filter(x => x.estado === 'activa' && !idsConLecturaMes.has(x.id)).length,
        });
        const sorted = [...p].map(x => ({ ...x, totalPages: (x.contador_negro_actual || 0) + (x.contador_color_actual || 0) }))
          .sort((a, b) => b.totalPages - a.totalPages).slice(0, 5);
        setTopPrinters(sorted as TopPrinter[]);
      }

      if (readingsResp.data) {
        setRecentReadings(readingsResp.data as RecentReading[]);
        const today = new Date().toDateString();
        const todayCount = readingsResp.data.filter(r => new Date(r.fecha_lectura).toDateString() === today).length;
        setStats(prev => ({ ...prev, lecturasHoy: todayCount }));
      }

      // Calcular tendencias mes actual vs anterior usando chartReadings
      if (chartReadingsResp.data && chartReadingsResp.data.length > 0) {
        const now = new Date();
        const startCurrent = new Date(now.getFullYear(), now.getMonth(), 1);
        const startPrev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const all = chartReadingsResp.data as ReadingMin[];
        // Lecturas por mes
        const lectMes = all.filter(r => new Date(r.fecha_lectura) >= startCurrent).length;
        const lectMesAnt = all.filter(r => {
          const d = new Date(r.fecha_lectura);
          return d >= startPrev && d < startCurrent;
        }).length;
        // Páginas consumidas: por impresora, max - min en cada periodo
        const pagesInRange = (from: Date, to: Date | null) => {
          const byPrinter: Record<string, { min: number; max: number }> = {};
          for (const r of all) {
            const d = new Date(r.fecha_lectura);
            if (d < from) continue;
            if (to && d >= to) continue;
            const tot = (r.contador_negro || 0) + (r.contador_color || 0);
            const cur = byPrinter[r.impresora_id];
            if (!cur) byPrinter[r.impresora_id] = { min: tot, max: tot };
            else { cur.min = Math.min(cur.min, tot); cur.max = Math.max(cur.max, tot); }
          }
          return Object.values(byPrinter).reduce((acc, v) => acc + Math.max(0, v.max - v.min), 0);
        };
        const pagMes = pagesInRange(startCurrent, null);
        const pagMesAnt = pagesInRange(startPrev, startCurrent);
        setStats(prev => ({ ...prev, paginasMesActual: pagMes, paginasMesAnterior: pagMesAnt, lecturasMes: lectMes, lecturasMesAnterior: lectMesAnt }));
      }
      } catch (error) {
        console.error('Error al cargar datos:', error);
        setFetchError('No se pudieron cargar los datos. Verificá tu conexión.');
      } finally {
        setLoading(false);
      }
    };

  useEffect(() => {
    fetchData();
  }, []);

  const getSectorName = (id: string | null) => sectores.find(s => s.id === id)?.nombre || '';
  const getFilialName = (printerId: string) => {
    const p = printers.find(x => x.id === printerId);
    if (!p?.filial_id) return '';
    return filiales.find(f => f.id === p.filial_id)?.nombre || '';
  };

  const trendOf = (current: number, previous: number): { pct: number | null; dir: 'up' | 'down' | 'flat' } => {
    if (previous === 0) return { pct: current > 0 ? 100 : null, dir: current > 0 ? 'up' : 'flat' };
    const pct = ((current - previous) / previous) * 100;
    if (Math.abs(pct) < 1) return { pct: 0, dir: 'flat' };
    return { pct, dir: pct > 0 ? 'up' : 'down' };
  };
  const pagesTrend = trendOf(stats.paginasMesActual, stats.paginasMesAnterior);
  const readingsTrend = trendOf(stats.lecturasMes, stats.lecturasMesAnterior);

  const statCards = [
     { title: 'Total Páginas Impresas', value: (stats.totalPaginasNegro + stats.totalPaginasColor).toLocaleString(), subtitle: `${stats.totalPaginasNegro.toLocaleString()} B/N · ${stats.totalPaginasColor.toLocaleString()} Color`, icon: FileText, color: 'text-primary', bgColor: 'bg-primary/10', trend: pagesTrend, trendLabel: 'vs mes anterior' },
     { title: 'Impresoras Activas', value: stats.activas, subtitle: `${stats.total} registradas en total`, icon: CheckCircle, color: 'text-success', bgColor: 'bg-success/10', trend: null, trendLabel: '' },
     { title: 'Piezas con Alerta', value: piezasConAlerta.length, subtitle: 'Próximas a vencer', icon: Package, color: 'text-warning', bgColor: 'bg-warning/10', onClick: () => navigate('/dashboard/piezas'), trend: null, trendLabel: '' },
     { title: 'Lecturas Hoy', value: stats.lecturasHoy, subtitle: `${stats.lecturasMes} en el mes`, icon: Clock, color: 'text-info', bgColor: 'bg-info/10', trend: readingsTrend, trendLabel: 'lecturas vs mes anterior' },
     { title: 'Sin lectura este mes', value: stats.sinLecturaMes, subtitle: `de ${stats.activas} impresoras activas`, icon: FileWarning, color: 'text-warning', bgColor: 'bg-warning/10', onClick: () => navigate('/dashboard/registro-uso?tab=sin-actividad'), trend: null, trendLabel: '' },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold">Panel de Control</h1>
            <p className="text-muted-foreground">Bienvenido, {user?.user_metadata?.full_name || user?.email}</p>
          </div>
          <Button onClick={() => navigate('/dashboard/registro-uso')} className="gap-2"><TrendingUp className="w-4 h-4" />Registrar Lectura</Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
          {statCards.map((stat, index) => (
            <Card key={stat.title} className={cn("hover-lift animate-fade-in transition-shadow hover:shadow-lg", stat.onClick && "cursor-pointer")} style={{ animationDelay: `${index * 100}ms` }} onClick={stat.onClick}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground">{stat.title}</p>
                    <p className="text-3xl font-bold mt-1">{loading ? '...' : stat.value}</p>
                    <p className="text-xs text-muted-foreground mt-1">{stat.subtitle}</p>
                    {stat.trend && stat.trend.pct !== null && (
                      <div className="flex items-center gap-1 mt-2">
                        {stat.trend.dir === 'up' && <ArrowUp className="w-3 h-3 text-success" />}
                        {stat.trend.dir === 'down' && <ArrowDown className="w-3 h-3 text-destructive" />}
                        {stat.trend.dir === 'flat' && <Minus className="w-3 h-3 text-muted-foreground" />}
                        <span className={cn("text-xs font-semibold",
                          stat.trend.dir === 'up' && "text-success",
                          stat.trend.dir === 'down' && "text-destructive",
                          stat.trend.dir === 'flat' && "text-muted-foreground"
                        )}>
                          {Math.abs(stat.trend.pct).toFixed(0)}%
                        </span>
                        <span className="text-[10px] text-muted-foreground ml-1">{stat.trendLabel}</span>
                      </div>
                    )}
                  </div>
                  <div className={cn('p-3 rounded-xl', stat.bgColor)}><stat.icon className={cn('w-6 h-6', stat.color)} /></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {fetchError && !loading ? <FetchErrorState error={fetchError} onRetry={fetchData} /> : <>
        {/* Parts Alerts - always visible */}
        {piezasConAlerta.length > 0 && (
          <Card className="border-warning/50 bg-warning/5 animate-fade-in">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-warning"><Package className="w-5 h-5" />Piezas que Requieren Atención</CardTitle>
              <CardDescription>Componentes próximos a vencer o con vida útil agotada</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {piezasConAlerta.slice(0, 6).map(pieza => (
                  <div key={pieza.id} className={cn("p-3 rounded-lg border", pieza.status === 'critical' ? "border-destructive/50 bg-destructive/5" : "border-warning/50 bg-warning/5")}>
                    <div className="flex items-center justify-between mb-2">
                      <Badge variant="outline" className={cn("text-xs", pieza.status === 'critical' ? "border-destructive text-destructive" : "border-warning text-warning")}>
                        {TIPO_PIEZA_LABELS[pieza.tipo_pieza] || pieza.tipo_pieza}
                      </Badge>
                      <span className={cn("text-sm font-bold", pieza.status === 'critical' ? "text-destructive" : "text-warning")}>{pieza.porcentaje.toFixed(0)}%</span>
                    </div>
                    <p className="text-sm font-medium truncate">{pieza.nombre_pieza}</p>
                    <p className="text-xs text-muted-foreground truncate">{pieza.impresora?.nombre}</p>
                    <Progress value={pieza.porcentaje} className={cn("h-1.5 mt-2", pieza.status === 'critical' ? "[&>div]:bg-destructive" : "[&>div]:bg-warning")} />
                  </div>
                ))}
              </div>
              {piezasConAlerta.length > 6 && (
                <Button variant="outline" size="sm" className="mt-4" onClick={() => navigate('/dashboard/piezas')}>
                  Ver todas las piezas ({piezasConAlerta.length})<ArrowUpRight className="w-4 h-4 ml-1" />
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {/* Alerta: modelos sin precio configurado */}
        {modelosSinPrecio.length > 0 && (
          <Card className="border-warning/50 bg-warning/5 animate-fade-in cursor-pointer hover:bg-warning/10 transition-colors" onClick={() => navigate('/dashboard/costos')}>
            <CardContent className="pt-5 pb-5">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2 rounded-lg bg-warning/15 flex-shrink-0"><DollarSign className="w-5 h-5 text-warning" /></div>
                  <div className="min-w-0">
                    <p className="font-medium text-sm">⚠️ {modelosSinPrecio.length} modelo{modelosSinPrecio.length !== 1 ? 's' : ''} sin precio configurado</p>
                    <p className="text-xs text-muted-foreground truncate">El costo total puede estar subestimado · Click para completar precios</p>
                  </div>
                </div>
                <ArrowUpRight className="w-4 h-4 text-warning flex-shrink-0" />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Alerta: impresoras sin lecturas */}
        {noReadingPrinters.length > 0 && (
          <Card className="border-warning/50 bg-warning/5 animate-fade-in">
            <CardHeader className="pb-3 cursor-pointer" onClick={() => setShowNoReadingPanel(v => !v)}>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-warning">
                  <FileWarning className="w-5 h-5" />
                  {noReadingPrinters.length} impresora{noReadingPrinters.length !== 1 ? 's' : ''} sin lecturas registradas
                </CardTitle>
                <Button variant="ghost" size="sm">{showNoReadingPanel ? 'Ocultar' : 'Ver listado'}</Button>
              </div>
              <CardDescription>Equipos activos que nunca tuvieron una lectura de contadores</CardDescription>
            </CardHeader>
            {showNoReadingPanel && (
              <CardContent>
                <div className="space-y-1 max-h-72 overflow-y-auto">
                  {filiales.map(f => {
                    const items = noReadingPrinters.filter(p => p.filial_id === f.id);
                    if (items.length === 0) return null;
                    return (
                      <div key={f.id} className="mb-3">
                        <p className="text-xs font-semibold text-warning mb-1">{f.nombre} ({items.length})</p>
                        <div className="space-y-1 ml-2">
                          {items.map(p => (
                            <div key={p.id} className="flex items-center justify-between p-2 rounded bg-background/50 border text-sm">
                              <div className="min-w-0 flex-1">
                                <span className="font-medium">{p.nombre}</span>
                                <span className="text-muted-foreground"> — {p.modelo}</span>
                                <span className="text-xs text-muted-foreground block truncate">Serie: {p.serie} · {sectores.find(s => s.id === p.sector_id)?.nombre || 'Sin sector'}</span>
                              </div>
                              <Button size="sm" variant="outline" className="ml-2 flex-shrink-0" onClick={() => navigate(`/dashboard/registro-uso?impresora=${p.id}`)}>Registrar</Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                  {(() => {
                    const sinFilial = noReadingPrinters.filter(p => !p.filial_id);
                    if (sinFilial.length === 0) return null;
                    return (
                      <div className="mb-3">
                        <p className="text-xs font-semibold text-muted-foreground mb-1">Sin filial asignada ({sinFilial.length})</p>
                        <div className="space-y-1 ml-2">
                          {sinFilial.map(p => (
                            <div key={p.id} className="flex items-center justify-between p-2 rounded bg-background/50 border text-sm">
                              <span className="font-medium">{p.nombre} <span className="text-muted-foreground">— {p.modelo}</span></span>
                              <Button size="sm" variant="outline" onClick={() => navigate(`/dashboard/registro-uso?impresora=${p.id}`)}>Registrar</Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </CardContent>
            )}
          </Card>
        )}

        {(openRepairs.length > 0 || stats.enReparacion > 0) && (
          <Card className="border-warning/50 bg-warning/5 animate-fade-in">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-warning">
                <Wrench className="w-5 h-5" />
                Impresoras en Reparación ({openRepairs.length || stats.enReparacion})
              </CardTitle>
              <CardDescription>Días fuera de servicio desde la fecha de salida</CardDescription>
            </CardHeader>
            <CardContent>
              {openRepairs.length === 0 ? (
                <p className="text-sm text-muted-foreground">{stats.enReparacion} impresora(s) marcadas en reparación sin registro detallado.</p>
              ) : (
                <div className="space-y-2">
                  {openRepairs.slice(0, 5).map(r => {
                    const days = Math.max(0, Math.floor((Date.now() - new Date(r.fecha_salida).getTime()) / (1000 * 60 * 60 * 24)));
                    const colorClass = days > 15 ? 'bg-destructive/15 text-destructive border-destructive/40' : days > 7 ? 'bg-orange-500/15 text-orange-500 border-orange-500/40' : 'bg-warning/15 text-warning border-warning/40';
                    return (
                      <div key={r.id} className="flex items-center justify-between p-3 rounded-lg bg-background/50 border">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-sm truncate">{r.impresoras?.nombre} <span className="text-muted-foreground font-normal">— {r.impresoras?.modelo}</span></p>
                          <p className="text-xs text-muted-foreground truncate">{r.motivo}{r.tecnico_responsable && ` · ${r.tecnico_responsable}`}</p>
                        </div>
                        <Badge variant="outline" className={cn('ml-2 flex-shrink-0', colorClass)}>
                          {days} día{days !== 1 ? 's' : ''} fuera
                        </Badge>
                      </div>
                    );
                  })}
                  {openRepairs.length > 5 && (
                    <Button variant="outline" size="sm" className="w-full mt-2" onClick={() => navigate('/dashboard/impresoras')}>
                      Ver las {openRepairs.length - 5} restantes<ArrowUpRight className="w-4 h-4 ml-1" />
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {!loading && printers.length > 0 && (
          <DashboardCharts printers={printers} filiales={filiales} readings={chartReadings} />
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top Printers */}
          <Card className="animate-fade-in">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><BarChart3 className="w-5 h-5 text-primary" />Mayor Consumo</CardTitle>
              <CardDescription>Impresoras con más páginas impresas</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-14 bg-muted animate-pulse rounded-lg" />)}</div>
              ) : topPrinters.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground"><Printer className="w-12 h-12 mx-auto mb-2 opacity-50" /><p>No hay impresoras</p></div>
              ) : (
                <div className="space-y-3">
                  {topPrinters.map((printer, index) => {
                    const totalPages = (printer.contador_negro_actual || 0) + (printer.contador_color_actual || 0);
                    const maxPages = topPrinters[0] ? (topPrinters[0].contador_negro_actual || 0) + (topPrinters[0].contador_color_actual || 0) : 1;
                    const percentage = Math.round((totalPages / maxPages) * 100);
                    return (
                      <div key={printer.id} className="p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-sm font-bold text-muted-foreground">#{index + 1}</span>
                            <div className="min-w-0">
                              <span className="font-medium truncate block max-w-[180px]">{printer.nombre}</span>
                              <span className="text-xs text-muted-foreground truncate block max-w-[180px]">{printer.modelo}</span>
                            </div>
                          </div>
                          <Badge variant="outline">{totalPages.toLocaleString()} págs</Badge>
                        </div>
                        <div className="h-2 bg-background rounded-full overflow-hidden">
                          <div className="h-full gradient-primary rounded-full transition-all duration-500" style={{ width: `${percentage}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Activity - improved with model + sector + serie */}
          <Card className="animate-fade-in">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Activity className="w-5 h-5 text-primary" />Actividad Reciente</CardTitle>
              <CardDescription>Últimas lecturas con detalle de equipo</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-12 bg-muted animate-pulse rounded-lg" />)}</div>
              ) : recentReadings.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" /><p>No hay lecturas</p>
                  <Button variant="outline" size="sm" className="mt-4" onClick={() => navigate('/dashboard/registro-uso')}>Registrar primera lectura</Button>
                </div>
              ) : (
                <div className="space-y-2">
                  {recentReadings.slice(0, 8).map((reading) => {
                    const sectorName = getSectorName(reading.impresoras?.sector_id || null);
                    const filialName = getFilialName(reading.impresora_id);
                    return (
                      <div key={reading.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm">
                            Lectura – <span className="text-primary">{reading.impresoras?.modelo}</span>
                            {sectorName && <span className="text-muted-foreground"> – {sectorName}</span>}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Serie: {reading.impresoras?.serie}
                            {filialName && ` · ${filialName}`}
                            {' · '}
                            {new Date(reading.fecha_lectura).toLocaleDateString('es', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                        <div className="text-right text-sm flex-shrink-0">
                          {reading.contador_negro && <div className="text-muted-foreground">B/N: {reading.contador_negro.toLocaleString()}</div>}
                          {reading.contador_color && <div className="text-muted-foreground">Color: {reading.contador_color.toLocaleString()}</div>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {role === 'user' && (
          <Card className="animate-fade-in">
            <CardContent className="pt-6">
              <div className="flex flex-col sm:flex-row items-center gap-4 justify-between">
                <div>
                  <h3 className="font-semibold">¿Necesitas registrar una lectura?</h3>
                  <p className="text-sm text-muted-foreground">Accede rápidamente al registro de uso de impresoras</p>
                </div>
                <Button onClick={() => navigate('/dashboard/registro-uso')} className="gap-2"><TrendingUp className="w-4 h-4" />Ir a Registro de Uso</Button>
              </div>
            </CardContent>
          </Card>
        )}
        </>}
      </div>
    </DashboardLayout>
  );
}
