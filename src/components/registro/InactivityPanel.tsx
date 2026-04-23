import { useMemo, useState } from 'react';
import { CalendarDays, Download, FileText, FileWarning, Plus } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { addPDFHeader, addPDFPageNumbers } from '@/lib/pdfHeader';
import { cn } from '@/lib/utils';

interface Impresora {
  id: string;
  nombre: string;
  serie: string;
  modelo: string;
  fecha_registro: string;
  sector_id: string | null;
  filial_id: string | null;
  estado?: string;
}

interface LecturaContador {
  id: string;
  impresora_id: string;
  fecha_lectura: string;
}

interface Sector { id: string; nombre: string }
interface Filial { id: string; nombre: string }

interface Props {
  impresoras: Impresora[];
  lecturas: LecturaContador[];
  sectores: Sector[];
  filiales: Filial[];
  onRegister: (printerId: string) => void;
}

const formatMonthValue = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

export function InactivityPanel({ impresoras, lecturas, sectores, filiales, onRegister }: Props) {
  const [selectedMonth, setSelectedMonth] = useState(formatMonthValue(new Date()));

  const monthRange = useMemo(() => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 1);
    return {
      start,
      end,
      label: start.toLocaleDateString('es', { month: 'long', year: 'numeric' }),
    };
  }, [selectedMonth]);

  const rows = useMemo(() => {
    return impresoras
      .filter((printer) => printer.estado === 'activa')
      .map((printer) => {
      const printerReadings = lecturas
        .filter((reading) => reading.impresora_id === printer.id)
        .sort((a, b) => new Date(b.fecha_lectura).getTime() - new Date(a.fecha_lectura).getTime());

      const hasReadingThisMonth = printerReadings.some((reading) => {
        const date = new Date(reading.fecha_lectura);
        return date >= monthRange.start && date < monthRange.end;
      });

      const lastReading = printerReadings[0] || null;
      const referenceDate = lastReading ? new Date(lastReading.fecha_lectura) : new Date(printer.fecha_registro);
      const diffDays = Math.max(0, Math.floor((Date.now() - referenceDate.getTime()) / (1000 * 60 * 60 * 24)));

      return {
        id: printer.id,
        nombre: printer.nombre,
        serie: printer.serie,
        modelo: printer.modelo,
        filial: filiales.find((item) => item.id === printer.filial_id)?.nombre || '-',
        sector: sectores.find((item) => item.id === printer.sector_id)?.nombre || '-',
        lastReadingLabel: lastReading
          ? new Date(lastReading.fecha_lectura).toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' })
          : 'Nunca',
        daysWithoutReading: diffDays,
        neverRead: !lastReading,
        hasReadingThisMonth,
      };
    }).filter((row) => !row.hasReadingThisMonth);
  }, [filiales, impresoras, lecturas, monthRange.end, monthRange.start, sectores]);

  const exportCSV = () => {
    if (rows.length === 0) return;
    const headers = ['Impresora', 'Modelo', 'Filial', 'Sector', 'UltimaLectura', 'DiasSinLectura'];
    const body = rows.map((row) => [
      `${row.nombre} (${row.serie})`,
      row.modelo,
      row.filial,
      row.sector,
      row.lastReadingLabel,
      row.neverRead ? 'Nunca' : row.daysWithoutReading,
    ]);
    const csv = [headers.join(','), ...body.map((line) => line.map((value) => `"${value}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `impresoras_sin_actividad_${selectedMonth}.csv`;
    link.click();
  };

  const exportPDF = () => {
    const doc = new jsPDF('landscape');
    const startY = addPDFHeader(doc, 'Impresoras sin Actividad', monthRange.label);
    autoTable(doc, {
      startY,
      head: [['Impresora', 'Modelo', 'Filial', 'Sector', 'Última lectura', 'Días sin lectura']],
      body: rows.map((row) => [
        `${row.nombre} (${row.serie})`,
        row.modelo,
        row.filial,
        row.sector,
        row.lastReadingLabel,
        row.neverRead ? 'Nunca' : row.daysWithoutReading.toString(),
      ]),
      theme: 'striped',
      headStyles: { fillColor: [59, 130, 246], textColor: 255 },
      styles: { fontSize: 8 },
    });
    addPDFPageNumbers(doc);
    doc.save(`impresoras_sin_actividad_${selectedMonth}.pdf`);
  };

  const dayTone = (row: typeof rows[number]) => {
    if (row.neverRead || row.daysWithoutReading > 60) return 'text-destructive bg-destructive/10 border-destructive/20';
    if (row.daysWithoutReading >= 31) return 'text-warning bg-warning/15 border-warning/30';
    if (row.daysWithoutReading >= 15) return 'text-warning bg-warning/10 border-warning/20';
    return 'text-muted-foreground bg-muted border-border';
  };

  return (
    <Card>
      <CardHeader className="gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <FileWarning className="h-5 w-5 text-warning" />
            Impresoras sin Actividad
          </CardTitle>
          <CardDescription>
            {rows.length} impresora{rows.length !== 1 ? 's' : ''} sin lectura en {monthRange.label} de {impresoras.filter((printer) => printer.estado === 'activa').length} total
          </CardDescription>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="w-full sm:w-[180px]">
            <Input type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} />
          </div>
          <Button variant="outline" className="gap-2" onClick={exportCSV}>
            <Download className="h-4 w-4" />CSV
          </Button>
          <Button variant="outline" className="gap-2" onClick={exportPDF}>
            <FileText className="h-4 w-4" />PDF
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border bg-muted/30 px-4 py-3 text-sm">
          <span className="font-medium">Resumen:</span> {rows.length} impresoras sin lectura este mes de {impresoras.filter((printer) => printer.estado === 'activa').length} total
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Impresora</TableHead>
                <TableHead>Modelo</TableHead>
                <TableHead>Filial</TableHead>
                <TableHead>Sector</TableHead>
                <TableHead>Última lectura</TableHead>
                <TableHead>Días sin lectura</TableHead>
                <TableHead className="text-right">Acción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-12 text-center text-muted-foreground">
                    <CalendarDays className="mx-auto mb-3 h-8 w-8 opacity-40" />
                    No hay impresoras pendientes para el mes seleccionado.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{row.nombre}</p>
                        <p className="text-xs text-muted-foreground">{row.serie}</p>
                      </div>
                    </TableCell>
                    <TableCell>{row.modelo}</TableCell>
                    <TableCell>{row.filial}</TableCell>
                    <TableCell>{row.sector}</TableCell>
                    <TableCell className={cn('font-medium', row.neverRead && 'text-muted-foreground')}>{row.lastReadingLabel}</TableCell>
                    <TableCell>
                      <span className={cn('inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium', dayTone(row))}>
                        {row.neverRead ? 'Nunca' : `${row.daysWithoutReading} días`}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" className="gap-2" onClick={() => onRegister(row.id)}>
                        <Plus className="h-4 w-4" />Registrar lectura
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
