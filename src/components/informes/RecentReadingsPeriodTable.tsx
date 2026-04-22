import { useMemo } from 'react';
import { User } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';

interface Reading {
  id: string;
  fecha_lectura: string;
  contador_negro: number | null;
  contador_color: number | null;
  registrado_por: string;
  impresora_id: string;
  impresoras?: { nombre: string; serie: string };
}

interface Props {
  lecturas: Reading[];
  filteredPrinterIds: Set<string>;
  getProfileName: (userId: string | null) => string;
}

interface Row extends Reading {
  blackPeriod: number | null;
  colorPeriod: number | null;
  totalPeriod: number | null;
  isHigh: boolean;
}

export function RecentReadingsPeriodTable({ lecturas, filteredPrinterIds, getProfileName }: Props) {
  const rows = useMemo<Row[]>(() => {
    const filtered = lecturas.filter((reading) => filteredPrinterIds.has(reading.impresora_id));
    const grouped = new Map<string, Reading[]>();

    filtered.forEach((reading) => {
      const list = grouped.get(reading.impresora_id) || [];
      list.push(reading);
      grouped.set(reading.impresora_id, list);
    });

    const result: Row[] = [];

    grouped.forEach((printerReadings) => {
      const asc = [...printerReadings].sort((a, b) => new Date(a.fecha_lectura).getTime() - new Date(b.fecha_lectura).getTime());
      const totals: number[] = [];

      asc.forEach((reading, index) => {
        if (index === 0) {
          result.push({ ...reading, blackPeriod: null, colorPeriod: null, totalPeriod: null, isHigh: false });
          return;
        }

        const previous = asc[index - 1];
        const blackPeriod = Math.max(0, (reading.contador_negro || 0) - (previous.contador_negro || 0));
        const colorPeriod = Math.max(0, (reading.contador_color || 0) - (previous.contador_color || 0));
        const totalPeriod = blackPeriod + colorPeriod;
        const historicalAverage = totals.length > 0 ? totals.reduce((acc, value) => acc + value, 0) / totals.length : null;
        const isHigh = historicalAverage !== null && totalPeriod > historicalAverage * 2;
        totals.push(totalPeriod);

        result.push({ ...reading, blackPeriod, colorPeriod, totalPeriod, isHigh });
      });
    });

    return result.sort((a, b) => new Date(b.fecha_lectura).getTime() - new Date(a.fecha_lectura).getTime()).slice(0, 20);
  }, [filteredPrinterIds, lecturas]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="h-5 w-5 text-primary" />Historial de Cargas Recientes
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha/Hora</TableHead>
                <TableHead>Impresora</TableHead>
                <TableHead className="text-right">Negro</TableHead>
                <TableHead className="text-right">Color</TableHead>
                <TableHead className="text-right">B/N Período</TableHead>
                <TableHead className="text-right">Color Período</TableHead>
                <TableHead className="text-right">Total Período</TableHead>
                <TableHead>Registrado Por</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((reading) => (
                <TableRow key={reading.id}>
                  <TableCell className="whitespace-nowrap text-sm">
                    {new Date(reading.fecha_lectura).toLocaleString('es', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </TableCell>
                  <TableCell className="font-medium">
                    {reading.impresoras?.nombre || '-'}
                    <p className="text-xs text-muted-foreground">{reading.impresoras?.serie || '-'}</p>
                  </TableCell>
                  <TableCell className="text-right font-mono">{reading.contador_negro?.toLocaleString() ?? '-'}</TableCell>
                  <TableCell className="text-right font-mono">{reading.contador_color?.toLocaleString() ?? '-'}</TableCell>
                  {reading.totalPeriod === null ? (
                    <TableCell colSpan={3} className="text-right text-muted-foreground">Primera lectura</TableCell>
                  ) : (
                    <>
                      <TableCell className="text-right text-info">+{reading.blackPeriod?.toLocaleString()}</TableCell>
                      <TableCell className="text-right text-success">+{reading.colorPeriod?.toLocaleString()}</TableCell>
                      <TableCell className={cn('text-right font-semibold', reading.isHigh ? 'text-warning' : 'text-success')}>
                        +{reading.totalPeriod?.toLocaleString()}
                      </TableCell>
                    </>
                  )}
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <User className="h-3 w-3 text-muted-foreground" />
                      <span className="text-sm">{getProfileName(reading.registrado_por)}</span>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
