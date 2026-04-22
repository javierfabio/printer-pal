import { useMemo } from 'react';
import { Activity, CalendarDays, FileText, Gauge, TrendingUp } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';

interface PrinterDetails {
  id: string;
  nombre: string;
  modelo: string;
  fecha_registro: string;
  contador_negro_inicial: number | null;
  contador_color_inicial: number | null;
  contador_negro_actual: number | null;
  contador_color_actual: number | null;
}

interface Reading {
  id: string;
  fecha_lectura: string;
  contador_negro: number | null;
  contador_color: number | null;
  notas?: string | null;
}

interface Props {
  printer: PrinterDetails | null;
  readings: Reading[];
}

interface ReadingRow extends Reading {
  diffBlack: number | null;
  diffColor: number | null;
  totalDiff: number | null;
}

const monthLabel = (value: string) => {
  const [year, month] = value.split('-').map(Number);
  const date = new Date(year, month - 1, 1);
  return date.toLocaleDateString('es', { month: 'short', year: 'numeric' });
};

const formatShortDate = (value: string) =>
  new Date(value).toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' });

const monthsBetween = (from: Date, to: Date) => {
  const diff = (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
  return Math.max(1, diff + 1);
};

export function PrinterUsageOverview({ printer, readings }: Props) {
  const sortedReadings = useMemo(() => [...readings].sort((a, b) => new Date(a.fecha_lectura).getTime() - new Date(b.fecha_lectura).getTime()), [readings]);

  const readingRows = useMemo<ReadingRow[]>(() => {
    return sortedReadings.map((reading, index) => {
      if (index === 0) {
        return { ...reading, diffBlack: null, diffColor: null, totalDiff: null };
      }
      const previous = sortedReadings[index - 1];
      const diffBlack = Math.max(0, (reading.contador_negro || 0) - (previous.contador_negro || 0));
      const diffColor = Math.max(0, (reading.contador_color || 0) - (previous.contador_color || 0));
      return {
        ...reading,
        diffBlack,
        diffColor,
        totalDiff: diffBlack + diffColor,
      };
    }).reverse();
  }, [sortedReadings]);

  const stats = useMemo(() => {
    if (!printer) return null;
    const blackTotal = Math.max(0, (printer.contador_negro_actual || 0) - (printer.contador_negro_inicial || 0));
    const colorTotal = Math.max(0, (printer.contador_color_actual || 0) - (printer.contador_color_inicial || 0));
    const total = blackTotal + colorTotal;
    const registeredAt = new Date(printer.fecha_registro);
    const monthCount = monthsBetween(registeredAt, new Date());
    return {
      blackTotal,
      colorTotal,
      total,
      averageMonthly: Math.round(total / monthCount),
      registeredAtLabel: formatShortDate(printer.fecha_registro),
    };
  }, [printer]);

  const monthlyData = useMemo(() => {
    const months: string[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i -= 1) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`);
    }

    const byMonth: Record<string, { black: number; color: number }> = {};
    sortedReadings.forEach((reading) => {
      const date = new Date(reading.fecha_lectura);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const prev = byMonth[key];
      const currentBlack = reading.contador_negro || 0;
      const currentColor = reading.contador_color || 0;
      if (!prev || currentBlack + currentColor > prev.black + prev.color) {
        byMonth[key] = { black: currentBlack, color: currentColor };
      }
    });

    return months.map((month, index) => {
      const prev = index > 0 ? byMonth[months[index - 1]] : undefined;
      const curr = byMonth[month];
      const black = curr && prev ? Math.max(0, curr.black - prev.black) : 0;
      const color = curr && prev ? Math.max(0, curr.color - prev.color) : 0;
      return {
        mes: monthLabel(month),
        negro: black,
        color,
        total: black + color,
      };
    });
  }, [sortedReadings]);

  if (!printer || !stats) return null;

  const miniCards = [
    { label: 'Total impreso desde registro', value: stats.total.toLocaleString(), detail: `desde el ${stats.registeredAtLabel}`, icon: FileText, tone: 'text-primary bg-primary/10' },
    { label: 'B/N total', value: stats.blackTotal.toLocaleString(), detail: 'acumulado', icon: Activity, tone: 'text-info bg-info/10' },
    { label: 'Color total', value: stats.colorTotal.toLocaleString(), detail: 'acumulado', icon: TrendingUp, tone: 'text-success bg-success/10' },
    { label: 'Promedio mensual estimado', value: stats.averageMonthly.toLocaleString(), detail: 'págs / mes', icon: Gauge, tone: 'text-warning bg-warning/10' },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        {miniCards.map((item) => (
          <div key={item.label} className="rounded-lg border bg-muted/30 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">{item.label}</p>
                <p className="mt-1 text-2xl font-semibold">{item.value}</p>
                <p className="mt-1 text-xs text-muted-foreground">{item.detail}</p>
              </div>
              <div className={cn('rounded-lg p-2', item.tone)}>
                <item.icon className="h-4 w-4" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-lg border bg-muted/20 p-4">
        <div className="mb-4 flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-primary" />
          <div>
            <p className="font-medium">Consumo mensual</p>
            <p className="text-xs text-muted-foreground">B/N y Color agrupados por mes</p>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={monthlyData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
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
              formatter={(value: number) => `${value.toLocaleString('es')} págs`}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line type="monotone" dataKey="negro" stroke="hsl(var(--info))" strokeWidth={2.5} dot={{ r: 3 }} name="B/N" />
            <Line type="monotone" dataKey="color" stroke="hsl(var(--success))" strokeWidth={2.5} dot={{ r: 3 }} name="Color" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="rounded-lg border bg-muted/20 p-4">
        <div className="mb-4">
          <p className="font-medium">Lecturas recientes</p>
          <p className="text-xs text-muted-foreground">Incluye consumo del período entre una lectura y la anterior.</p>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead className="text-right">Negro</TableHead>
                <TableHead className="text-right">Color</TableHead>
                <TableHead className="text-right">B/N Período</TableHead>
                <TableHead className="text-right">Color Período</TableHead>
                <TableHead className="text-right">Total Período</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {readingRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                    Sin lecturas registradas para esta impresora.
                  </TableCell>
                </TableRow>
              ) : (
                readingRows.slice(0, 12).map((reading) => (
                  <TableRow key={reading.id}>
                    <TableCell className="whitespace-nowrap">
                      {new Date(reading.fecha_lectura).toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' })}
                      <span className="ml-2 text-xs text-muted-foreground">
                        {new Date(reading.fecha_lectura).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-medium">{reading.contador_negro?.toLocaleString() ?? '-'}</TableCell>
                    <TableCell className="text-right font-medium">{reading.contador_color?.toLocaleString() ?? '-'}</TableCell>
                    {reading.totalDiff === null ? (
                      <TableCell colSpan={3} className="text-right text-muted-foreground">Primera lectura</TableCell>
                    ) : (
                      <>
                        <TableCell className="text-right text-info">+{reading.diffBlack?.toLocaleString()}</TableCell>
                        <TableCell className="text-right text-success">+{reading.diffColor?.toLocaleString()}</TableCell>
                        <TableCell className="text-right font-semibold">+{reading.totalDiff?.toLocaleString()}</TableCell>
                      </>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
