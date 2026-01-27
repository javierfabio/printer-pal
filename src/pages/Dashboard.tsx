import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Printer, 
  AlertTriangle, 
  CheckCircle, 
  Wrench, 
  TrendingUp, 
  Activity,
  FileText,
  BarChart3,
  ArrowUpRight,
  Clock
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

interface Stats {
  total: number;
  activas: number;
  enReparacion: number;
  inactivas: number;
  totalPaginasNegro: number;
  totalPaginasColor: number;
  lecturasHoy: number;
  paginasHoy: number;
}

interface TopPrinter {
  id: string;
  nombre: string;
  modelo: string;
  contador_negro_actual: number;
  contador_color_actual: number;
  tipo_impresion: string;
}

interface RecentReading {
  id: string;
  fecha_lectura: string;
  contador_negro: number | null;
  contador_color: number | null;
  impresoras: {
    nombre: string;
    serie: string;
  };
}

export default function Dashboard() {
  const { user, role } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<Stats>({
    total: 0, activas: 0, enReparacion: 0, inactivas: 0,
    totalPaginasNegro: 0, totalPaginasColor: 0, lecturasHoy: 0, paginasHoy: 0
  });
  const [topPrinters, setTopPrinters] = useState<TopPrinter[]>([]);
  const [recentReadings, setRecentReadings] = useState<RecentReading[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      
      // Fetch all data in parallel
      const [printersResp, readingsResp] = await Promise.all([
        supabase.from('impresoras').select('*'),
        supabase.from('lecturas_contadores')
          .select('*, impresoras(nombre, serie)')
          .order('fecha_lectura', { ascending: false })
          .limit(10)
      ]);

      if (printersResp.data) {
        const printers = printersResp.data;
        
        // Calculate total pages
        const totalNegro = printers.reduce((acc, p) => acc + (p.contador_negro_actual || 0) - (p.contador_negro_inicial || 0), 0);
        const totalColor = printers.reduce((acc, p) => acc + (p.contador_color_actual || 0) - (p.contador_color_inicial || 0), 0);
        
        setStats({
          total: printers.length,
          activas: printers.filter(p => p.estado === 'activa').length,
          enReparacion: printers.filter(p => p.estado === 'en_reparacion').length,
          inactivas: printers.filter(p => p.estado === 'inactiva' || p.estado === 'baja').length,
          totalPaginasNegro: totalNegro,
          totalPaginasColor: totalColor,
          lecturasHoy: 0,
          paginasHoy: 0,
        });

        // Top printers by consumption
        const sorted = [...printers]
          .map(p => ({
            ...p,
            totalPages: (p.contador_negro_actual || 0) + (p.contador_color_actual || 0)
          }))
          .sort((a, b) => b.totalPages - a.totalPages)
          .slice(0, 5);
        
        setTopPrinters(sorted as TopPrinter[]);
      }

      if (readingsResp.data) {
        setRecentReadings(readingsResp.data as RecentReading[]);
        
        // Count today's readings
        const today = new Date().toDateString();
        const todayReadings = readingsResp.data.filter(
          r => new Date(r.fecha_lectura).toDateString() === today
        );
        
        setStats(prev => ({
          ...prev,
          lecturasHoy: todayReadings.length,
        }));
      }

      setLoading(false);
    };

    fetchData();
  }, []);

  const statCards = [
    {
      title: 'Total Páginas Impresas',
      value: (stats.totalPaginasNegro + stats.totalPaginasColor).toLocaleString(),
      subtitle: `${stats.totalPaginasNegro.toLocaleString()} B/N · ${stats.totalPaginasColor.toLocaleString()} Color`,
      icon: FileText,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
    },
    {
      title: 'Impresoras Activas',
      value: stats.activas,
      subtitle: `${stats.total} registradas en total`,
      icon: CheckCircle,
      color: 'text-success',
      bgColor: 'bg-success/10',
    },
    {
      title: 'En Reparación',
      value: stats.enReparacion,
      subtitle: 'Requieren atención',
      icon: Wrench,
      color: 'text-warning',
      bgColor: 'bg-warning/10',
    },
    {
      title: 'Lecturas Hoy',
      value: stats.lecturasHoy,
      subtitle: 'Registros del día',
      icon: Clock,
      color: 'text-info',
      bgColor: 'bg-info/10',
    },
  ];

  const getStatusBadge = (estado: string) => {
    const statusMap: Record<string, { label: string; className: string }> = {
      activa: { label: 'Activa', className: 'status-active' },
      inactiva: { label: 'Inactiva', className: 'status-inactive' },
      en_reparacion: { label: 'En Reparación', className: 'status-repair' },
      baja: { label: 'Baja', className: 'status-disabled' },
    };
    const status = statusMap[estado] || statusMap.inactiva;
    return (
      <span className={cn('px-2 py-1 rounded-full text-xs font-medium border', status.className)}>
        {status.label}
      </span>
    );
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold">Panel de Control</h1>
            <p className="text-muted-foreground">
              Bienvenido, {user?.user_metadata?.full_name || user?.email}
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => navigate('/dashboard/registro-uso')} className="gap-2">
              <TrendingUp className="w-4 h-4" />
              Registrar Lectura
            </Button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map((stat, index) => (
            <Card 
              key={stat.title} 
              className="hover-lift animate-fade-in cursor-pointer transition-shadow hover:shadow-lg" 
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground">{stat.title}</p>
                    <p className="text-3xl font-bold mt-1">{loading ? '...' : stat.value}</p>
                    <p className="text-xs text-muted-foreground mt-1">{stat.subtitle}</p>
                  </div>
                  <div className={cn('p-3 rounded-xl', stat.bgColor)}>
                    <stat.icon className={cn('w-6 h-6', stat.color)} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Alerts Section */}
        {stats.enReparacion > 0 && (
          <Card className="border-warning/50 bg-warning/5 animate-fade-in" style={{ animationDelay: '300ms' }}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-warning/20">
                  <AlertTriangle className="w-6 h-6 text-warning" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-warning">Atención Requerida</p>
                  <p className="text-sm text-muted-foreground">
                    Hay {stats.enReparacion} impresora(s) en reparación que requieren seguimiento.
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => navigate('/dashboard/impresoras')}>
                  Ver detalles
                  <ArrowUpRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top Printers by Consumption */}
          <Card className="animate-fade-in" style={{ animationDelay: '400ms' }}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-primary" />
                Mayor Consumo
              </CardTitle>
              <CardDescription>Impresoras con más páginas impresas</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="h-14 bg-muted animate-pulse rounded-lg" />
                  ))}
                </div>
              ) : topPrinters.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Printer className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No hay impresoras registradas</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {topPrinters.map((printer, index) => {
                    const totalPages = (printer.contador_negro_actual || 0) + (printer.contador_color_actual || 0);
                    const maxPages = topPrinters[0] 
                      ? (topPrinters[0].contador_negro_actual || 0) + (topPrinters[0].contador_color_actual || 0)
                      : 1;
                    const percentage = Math.round((totalPages / maxPages) * 100);
                    
                    return (
                      <div
                        key={printer.id}
                        className="p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-muted-foreground">#{index + 1}</span>
                            <span className="font-medium truncate max-w-[150px]">{printer.nombre}</span>
                          </div>
                          <Badge variant="outline">{totalPages.toLocaleString()} págs</Badge>
                        </div>
                        <div className="h-2 bg-background rounded-full overflow-hidden">
                          <div 
                            className="h-full gradient-primary rounded-full transition-all duration-500"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card className="animate-fade-in" style={{ animationDelay: '500ms' }}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-primary" />
                Actividad Reciente
              </CardTitle>
              <CardDescription>Últimas lecturas de contadores</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="h-12 bg-muted animate-pulse rounded-lg" />
                  ))}
                </div>
              ) : recentReadings.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No hay lecturas registradas</p>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="mt-4"
                    onClick={() => navigate('/dashboard/registro-uso')}
                  >
                    Registrar primera lectura
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  {recentReadings.slice(0, 6).map((reading) => (
                    <div
                      key={reading.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{reading.impresoras?.nombre}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(reading.fecha_lectura).toLocaleDateString('es', {
                            day: '2-digit',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                      <div className="text-right text-sm">
                        {reading.contador_negro && (
                          <div className="text-muted-foreground">B/N: {reading.contador_negro.toLocaleString()}</div>
                        )}
                        {reading.contador_color && (
                          <div className="text-muted-foreground">Color: {reading.contador_color.toLocaleString()}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions for standard users */}
        {role === 'user' && (
          <Card className="animate-fade-in" style={{ animationDelay: '600ms' }}>
            <CardContent className="pt-6">
              <div className="flex flex-col sm:flex-row items-center gap-4 justify-between">
                <div>
                  <h3 className="font-semibold">¿Necesitas registrar una lectura?</h3>
                  <p className="text-sm text-muted-foreground">
                    Accede rápidamente al registro de uso de impresoras
                  </p>
                </div>
                <Button onClick={() => navigate('/dashboard/registro-uso')} className="gap-2">
                  <TrendingUp className="w-4 h-4" />
                  Ir a Registro de Uso
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
