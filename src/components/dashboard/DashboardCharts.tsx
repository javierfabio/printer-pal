import { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart3, LineChart as LineIcon } from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell,
  LineChart, Line, Legend,
} from 'recharts';
import { useNavigate } from 'react-router-dom';

interface PrinterMin {
  id: string;
  nombre: string;
  modelo: string;
  filial_id: string | null;
  contador_negro_actual: number | null;
  contador_color_actual: number | null;
}

interface Filial { id: string; nombre: string; }

interface Reading {
  id: string;
  impresora_id: string;
  fecha_lectura: string;
  contador_negro: number | null;
  contador_color: number | null;
}

interface Props {
  printers: PrinterMin[];
  filiales: Filial[];
  readings: Reading[];
}

const CHART_COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--info))',
  'hsl(var(--success))',
  'hsl(var(--warning))',
  'hsl(var(--destructive))',
  'hsl(217 91% 60%)',
  'hsl(280 65% 60%)',
  'hsl(160 60% 45%)',
];

export function DashboardCharts({ printers, filiales, readings }: Props) {
  const navigate = useNavigate();

  // Distribución de impresoras por filial
  const filialData = useMemo(() => {
    const counts: Record<string, number> = {};
    printers.forEach(p => {
      const key = p.filial_id || '__sin__';
      counts[key] = (counts[key] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([id, count]) => ({
        id,
        nombre: id === '__sin__' ? 'Sin filial' : (filiales.find(f => f.id === id)?.nombre || 'Desconocida'),
        cantidad: count,
      }))
      .sort((a, b) => b.cantidad - a.cantidad);
  }, [printers, filiales]);

  // Consumo mensual de las top 5 impresoras (últimos 6 meses)
  const { monthlyData, topNames } = useMemo(() => {
    // Total páginas por impresora (para identificar top 5)
    const totalPorImp: Record<string, number> = {};
    printers.forEach(p => {
      totalPorImp[p.id] = (p.contador_negro_actual || 0) + (p.contador_color_actual || 0);
    });
    const top5 = [...printers].sort((a, b) => (totalPorImp[b.id] || 0) - (totalPorImp[a.id] || 0)).slice(0, 5);
    const top5Ids = new Set(top5.map(p => p.id));
    const top5Map = new Map(top5.map(p => [p.id, p.nombre]));

    // Agrupar lecturas por impresora y mes (último valor del mes)
    const byPrinterMonth: Record<string, Record<string, number>> = {};
    readings
      .filter(r => top5Ids.has(r.impresora_id))
      .forEach(r => {
        const d = new Date(r.fecha_lectura);
        const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const total = (r.contador_negro || 0) + (r.contador_color || 0);
        if (!byPrinterMonth[r.impresora_id]) byPrinterMonth[r.impresora_id] = {};
        // Guardar el valor más alto del mes (último contador)
        const prev = byPrinterMonth[r.impresora_id][month];
        if (prev === undefined || total > prev) byPrinterMonth[r.impresora_id][month] = total;
      });

    // Últimos 6 meses
    const months: string[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }

    // Calcular consumo del mes (diff con mes anterior por impresora)
    const data = months.map(m => {
      const row: Record<string, any> = { mes: formatMonth(m) };
      top5.forEach(p => {
        const idx = months.indexOf(m);
        const prev = idx > 0 ? byPrinterMonth[p.id]?.[months[idx - 1]] : undefined;
        const curr = byPrinterMonth[p.id]?.[m];
        if (curr !== undefined && prev !== undefined && curr >= prev) {
          row[p.nombre] = curr - prev;
        } else if (curr !== undefined && prev === undefined) {
          row[p.nombre] = 0;
        } else {
          row[p.nombre] = 0;
        }
      });
      return row;
    });

    return { monthlyData: data, topNames: top5.map(p => p.nombre) };
  }, [printers, readings]);

  const handleFilialClick = (data: any) => {
    if (data?.id && data.id !== '__sin__') {
      navigate(`/dashboard/impresoras?filial=${data.id}`);
    } else {
      navigate('/dashboard/impresoras');
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fade-in">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-primary" />
            Distribución por Filial
          </CardTitle>
          <CardDescription>Click en una barra para filtrar las impresoras de esa filial</CardDescription>
        </CardHeader>
        <CardContent>
          {filialData.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">Sin datos</div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={filialData} margin={{ top: 10, right: 10, left: 0, bottom: 30 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="nombre"
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={11}
                  angle={-25}
                  textAnchor="end"
                  height={60}
                  interval={0}
                />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--popover))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '0.5rem',
                    color: 'hsl(var(--popover-foreground))',
                  }}
                  cursor={{ fill: 'hsl(var(--muted) / 0.4)' }}
                  formatter={(v: number) => [`${v} impresora(s)`, 'Cantidad']}
                />
                <Bar
                  dataKey="cantidad"
                  radius={[6, 6, 0, 0]}
                  cursor="pointer"
                  onClick={(data: any) => handleFilialClick(data)}
                >
                  {filialData.map((entry, i) => (
                    <Cell key={entry.id} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LineIcon className="w-5 h-5 text-primary" />
            Consumo Mensual — Top 5
          </CardTitle>
          <CardDescription>Páginas impresas por mes (últimos 6 meses)</CardDescription>
        </CardHeader>
        <CardContent>
          {topNames.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">Sin datos</div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={monthlyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="mes" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--popover))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '0.5rem',
                    color: 'hsl(var(--popover-foreground))',
                  }}
                  formatter={(v: number) => v.toLocaleString('es')}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {topNames.map((name, i) => (
                  <Line
                    key={name}
                    type="monotone"
                    dataKey={name}
                    stroke={CHART_COLORS[i % CHART_COLORS.length]}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function formatMonth(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  return `${meses[m - 1]} ${String(y).slice(-2)}`;
}