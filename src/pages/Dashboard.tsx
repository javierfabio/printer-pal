import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Printer, AlertTriangle, CheckCircle, Wrench, TrendingUp, Activity } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface Stats {
  total: number;
  activas: number;
  enReparacion: number;
  inactivas: number;
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats>({ total: 0, activas: 0, enReparacion: 0, inactivas: 0 });
  const [recentPrinters, setRecentPrinters] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      // Fetch printer stats
      const { data: printers, error } = await supabase
        .from('impresoras')
        .select('*');

      if (!error && printers) {
        setStats({
          total: printers.length,
          activas: printers.filter(p => p.estado === 'activa').length,
          enReparacion: printers.filter(p => p.estado === 'en_reparacion').length,
          inactivas: printers.filter(p => p.estado === 'inactiva' || p.estado === 'baja').length,
        });
        setRecentPrinters(printers.slice(0, 5));
      }
      setLoading(false);
    };

    fetchData();
  }, []);

  const statCards = [
    {
      title: 'Total Impresoras',
      value: stats.total,
      icon: Printer,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
    },
    {
      title: 'Activas',
      value: stats.activas,
      icon: CheckCircle,
      color: 'text-success',
      bgColor: 'bg-success/10',
    },
    {
      title: 'En Reparación',
      value: stats.enReparacion,
      icon: Wrench,
      color: 'text-warning',
      bgColor: 'bg-warning/10',
    },
    {
      title: 'Inactivas',
      value: stats.inactivas,
      icon: AlertTriangle,
      color: 'text-destructive',
      bgColor: 'bg-destructive/10',
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
        <div>
          <h1 className="text-3xl font-bold">Panel de Control</h1>
          <p className="text-muted-foreground">Resumen del estado de las impresoras</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map((stat, index) => (
            <Card key={stat.title} className="hover-lift animate-fade-in" style={{ animationDelay: `${index * 100}ms` }}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{stat.title}</p>
                    <p className="text-3xl font-bold mt-1">{loading ? '...' : stat.value}</p>
                  </div>
                  <div className={cn('p-3 rounded-xl', stat.bgColor)}>
                    <stat.icon className={cn('w-6 h-6', stat.color)} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Recent Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="animate-fade-in" style={{ animationDelay: '400ms' }}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-primary" />
                Impresoras Recientes
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="h-12 bg-muted animate-pulse rounded-lg" />
                  ))}
                </div>
              ) : recentPrinters.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Printer className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No hay impresoras registradas</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {recentPrinters.map((printer) => (
                    <div
                      key={printer.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                    >
                      <div>
                        <p className="font-medium">{printer.nombre}</p>
                        <p className="text-sm text-muted-foreground">
                          {printer.modelo} · Serie: {printer.serie}
                        </p>
                      </div>
                      {getStatusBadge(printer.estado)}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="animate-fade-in" style={{ animationDelay: '500ms' }}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-primary" />
                Resumen de Contadores
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="h-40 bg-muted animate-pulse rounded-lg" />
              ) : recentPrinters.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <TrendingUp className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>Sin datos de contadores</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {recentPrinters.slice(0, 4).map((printer) => (
                    <div key={printer.id} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium truncate max-w-[150px]">{printer.nombre}</span>
                        <span className="text-muted-foreground">
                          {printer.tipo_impresion === 'color' ? (
                            <>Color: {printer.contador_color_actual}</>
                          ) : (
                            <>B/N: {printer.contador_negro_actual}</>
                          )}
                        </span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div 
                          className="h-full gradient-primary rounded-full"
                          style={{ 
                            width: `${Math.min((printer.contador_negro_actual || printer.contador_color_actual) / 10000 * 100, 100)}%` 
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
