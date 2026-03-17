import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Printer, CheckCircle, Wrench, TrendingUp, Activity, FileText, BarChart3,
  ArrowUpRight, Clock, Package
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { usePartsAlerts, TIPO_PIEZA_LABELS } from '@/hooks/usePartsAlerts';

interface Stats {
  total: number; activas: number; enReparacion: number; inactivas: number;
  totalPaginasNegro: number; totalPaginasColor: number; lecturasHoy: number;
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

interface Sector { id: string; nombre: string; }
interface Filial { id: string; nombre: string; }
interface PrinterFull { id: string; sector_id: string | null; filial_id: string | null; }

export default function Dashboard() {
  const { user, role } = useAuth();
  const navigate = useNavigate();
  const { alerts: piezasConAlerta, loading: alertsLoading } = usePartsAlerts();
  const [stats, setStats] = useState<Stats>({
    total: 0, activas: 0, enReparacion: 0, inactivas: 0,
    totalPaginasNegro: 0, totalPaginasColor: 0, lecturasHoy: 0,
  });
  const [topPrinters, setTopPrinters] = useState<TopPrinter[]>([]);
  const [recentReadings, setRecentReadings] = useState<RecentReading[]>([]);
  const [sectores, setSectores] = useState<Sector[]>([]);
  const [filiales, setFiliales] = useState<Filial[]>([]);
  const [printers, setPrinters] = useState<PrinterFull[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const [printersResp, readingsResp, secResp, filResp] = await Promise.all([
        supabase.from('impresoras').select('*'),
        supabase.from('lecturas_contadores')
          .select('*, impresoras(nombre, serie, modelo, sector_id)')
          .order('fecha_lectura', { ascending: false })
          .limit(15),
        supabase.from('sectores').select('id, nombre').eq('activo', true),
        supabase.from('filiales').select('id, nombre').eq('activo', true),
      ]);

      if (secResp.data) setSectores(secResp.data);
      if (filResp.data) setFiliales(filResp.data);

      if (printersResp.data) {
        const p = printersResp.data;
        setPrinters(p.map(x => ({ id: x.id, sector_id: x.sector_id, filial_id: x.filial_id })));
        const totalNegro = p.reduce((acc, x) => acc + (x.contador_negro_actual || 0) - (x.contador_negro_inicial || 0), 0);
        const totalColor = p.reduce((acc, x) => acc + (x.contador_color_actual || 0) - (x.contador_color_inicial || 0), 0);
        setStats({
          total: p.length,
          activas: p.filter(x => x.estado === 'activa').length,
          enReparacion: p.filter(x => x.estado === 'en_reparacion').length,
          inactivas: p.filter(x => x.estado === 'inactiva' || x.estado === 'baja').length,
          totalPaginasNegro: totalNegro, totalPaginasColor: totalColor,
          lecturasHoy: 0,
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
      setLoading(false);
    };
    fetchData();
  }, []);

  const getSectorName = (id: string | null) => sectores.find(s => s.id === id)?.nombre || '';
  const getFilialName = (printerId: string) => {
    const p = printers.find(x => x.id === printerId);
    if (!p?.filial_id) return '';
    return filiales.find(f => f.id === p.filial_id)?.nombre || '';
  };

  const statCards = [
    { title: 'Total Páginas Impresas', value: (stats.totalPaginasNegro + stats.totalPaginasColor).toLocaleString(), subtitle: `${stats.totalPaginasNegro.toLocaleString()} B/N · ${stats.totalPaginasColor.toLocaleString()} Color`, icon: FileText, color: 'text-primary', bgColor: 'bg-primary/10' },
    { title: 'Impresoras Activas', value: stats.activas, subtitle: `${stats.total} registradas en total`, icon: CheckCircle, color: 'text-success', bgColor: 'bg-success/10' },
    { title: 'Piezas con Alerta', value: piezasConAlerta.length, subtitle: 'Próximas a vencer', icon: Package, color: 'text-warning', bgColor: 'bg-warning/10', onClick: () => navigate('/dashboard/piezas') },
    { title: 'Lecturas Hoy', value: stats.lecturasHoy, subtitle: 'Registros del día', icon: Clock, color: 'text-info', bgColor: 'bg-info/10' },
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

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map((stat, index) => (
            <Card key={stat.title} className={cn("hover-lift animate-fade-in transition-shadow hover:shadow-lg", stat.onClick && "cursor-pointer")} style={{ animationDelay: `${index * 100}ms` }} onClick={stat.onClick}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground">{stat.title}</p>
                    <p className="text-3xl font-bold mt-1">{loading ? '...' : stat.value}</p>
                    <p className="text-xs text-muted-foreground mt-1">{stat.subtitle}</p>
                  </div>
                  <div className={cn('p-3 rounded-xl', stat.bgColor)}><stat.icon className={cn('w-6 h-6', stat.color)} /></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

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

        {stats.enReparacion > 0 && (
          <Card className="border-warning/50 bg-warning/5 animate-fade-in">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-warning/20"><Wrench className="w-6 h-6 text-warning" /></div>
                <div className="flex-1">
                  <p className="font-semibold text-warning">Impresoras en Reparación</p>
                  <p className="text-sm text-muted-foreground">{stats.enReparacion} impresora(s) en reparación.</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => navigate('/dashboard/impresoras')}>Ver detalles<ArrowUpRight className="w-4 h-4 ml-1" /></Button>
              </div>
            </CardContent>
          </Card>
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
      </div>
    </DashboardLayout>
  );
}
