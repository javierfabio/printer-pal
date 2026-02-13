import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  BarChart3,
  Download,
  Filter,
  Loader2,
  Printer,
  TrendingUp,
  FileText,
  PieChart,
  Wrench
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart as RechartsPie, Pie, Cell, Legend } from 'recharts';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { addPDFHeader, addPDFPageNumbers } from '@/lib/pdfHeader';

interface Impresora {
  id: string;
  nombre: string;
  serie: string;
  modelo: string;
  tipo_impresion: string;
  contador_negro_actual: number;
  contador_color_actual: number;
  contador_negro_inicial: number;
  contador_color_inicial: number;
  sector_id: string | null;
  filial_id: string | null;
}

interface Sector {
  id: string;
  nombre: string;
}

interface Filial {
  id: string;
  nombre: string;
}

interface PiezaInfo {
  id: string;
  nombre_pieza: string;
  tipo_pieza: string;
  vida_util_estimada: number;
  porcentaje_usado: number;
  impresora_nombre: string;
  impresora_serie: string;
}

const COLORS = ['hsl(221, 83%, 53%)', 'hsl(142, 76%, 36%)', 'hsl(38, 92%, 50%)', 'hsl(0, 84%, 60%)', 'hsl(262, 83%, 58%)'];

const TIPO_PIEZA_LABELS: Record<string, string> = {
  toner_negro: 'Tóner Negro',
  toner_color: 'Tóner Color',
  fusor: 'Fusor',
  unidad_imagen: 'Unidad de Imagen',
  malla: 'Malla / Mesh',
  transfer_belt: 'Transfer Belt',
  rodillo: 'Rodillo',
  otro: 'Otra Pieza',
};

export default function Informes() {
  const { role } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [impresoras, setImpresoras] = useState<Impresora[]>([]);
  const [sectores, setSectores] = useState<Sector[]>([]);
  const [filiales, setFiliales] = useState<Filial[]>([]);
  const [piezas, setPiezas] = useState<PiezaInfo[]>([]);
  
  // Filters
  const [filterSector, setFilterSector] = useState<string>('all');
  const [filterFilial, setFilterFilial] = useState<string>('all');
  const [filterDateFrom, setFilterDateFrom] = useState<string>('');
  const [filterDateTo, setFilterDateTo] = useState<string>('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    
    const [impResp, secResp, filResp, piezasResp] = await Promise.all([
      supabase.from('impresoras').select('*').eq('estado', 'activa'),
      supabase.from('sectores').select('*').eq('activo', true),
      supabase.from('filiales').select('*').eq('activo', true),
      supabase
        .from('piezas_impresora')
        .select('*, impresoras(nombre, serie, contador_negro_actual, contador_color_actual)')
        .eq('activo', true),
    ]);

    if (impResp.data) setImpresoras(impResp.data);
    if (secResp.data) setSectores(secResp.data);
    if (filResp.data) setFiliales(filResp.data);
    
    if (piezasResp.data) {
      const piezasInfo: PiezaInfo[] = piezasResp.data.map((p: any) => {
        const contadorActual = (p.impresoras?.contador_negro_actual || 0) + (p.impresoras?.contador_color_actual || 0);
        const paginasUsadas = contadorActual - p.contador_instalacion + p.paginas_consumidas;
        const porcentaje = Math.min(100, (paginasUsadas / p.vida_util_estimada) * 100);
        
        return {
          id: p.id,
          nombre_pieza: p.nombre_pieza,
          tipo_pieza: p.tipo_pieza,
          vida_util_estimada: p.vida_util_estimada,
          porcentaje_usado: porcentaje,
          impresora_nombre: p.impresoras?.nombre || '',
          impresora_serie: p.impresoras?.serie || '',
        };
      });
      setPiezas(piezasInfo);
    }
    
    setLoading(false);
  };

  // Filter printers
  const filteredImpresoras = impresoras.filter(imp => {
    if (filterSector !== 'all' && imp.sector_id !== filterSector) return false;
    if (filterFilial !== 'all' && imp.filial_id !== filterFilial) return false;
    return true;
  });

  // Calculate stats
  const totalPaginasNegro = filteredImpresoras.reduce(
    (acc, imp) => acc + (imp.contador_negro_actual - imp.contador_negro_inicial), 0
  );
  const totalPaginasColor = filteredImpresoras.reduce(
    (acc, imp) => acc + (imp.contador_color_actual - imp.contador_color_inicial), 0
  );
  const totalPaginas = totalPaginasNegro + totalPaginasColor;

  // Chart data - Pages by printer
  const printerChartData = filteredImpresoras
    .map(imp => ({
      name: imp.nombre.length > 15 ? imp.nombre.substring(0, 15) + '...' : imp.nombre,
      negro: imp.contador_negro_actual - imp.contador_negro_inicial,
      color: imp.contador_color_actual - imp.contador_color_inicial,
      total: (imp.contador_negro_actual - imp.contador_negro_inicial) + (imp.contador_color_actual - imp.contador_color_inicial),
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);

  // Chart data - Pages by sector
  const sectorChartData = sectores.map(sector => {
    const sectorPrinters = filteredImpresoras.filter(imp => imp.sector_id === sector.id);
    const total = sectorPrinters.reduce((acc, imp) => 
      acc + (imp.contador_negro_actual - imp.contador_negro_inicial) + (imp.contador_color_actual - imp.contador_color_inicial), 0
    );
    return { name: sector.nombre, value: total };
  }).filter(s => s.value > 0);

  // Pie chart data
  const pieData = [
    { name: 'Blanco y Negro', value: totalPaginasNegro },
    { name: 'Color', value: totalPaginasColor },
  ].filter(d => d.value > 0);

  const exportToPDF = () => {
    const doc = new jsPDF();
    const startY = addPDFHeader(doc, 'Informe de Consumo de Impresoras');

    // Summary section
    doc.setFontSize(12);
    doc.setTextColor(40, 40, 40);
    doc.text('Resumen General', 14, startY);
    
    doc.setFontSize(10);
    doc.setTextColor(60, 60, 60);
    doc.text(`Total de Impresoras: ${filteredImpresoras.length}`, 14, startY + 8);
    doc.text(`Total de Páginas: ${totalPaginas.toLocaleString()}`, 14, startY + 14);
    doc.text(`Páginas B/N: ${totalPaginasNegro.toLocaleString()}`, 14, startY + 20);
    doc.text(`Páginas Color: ${totalPaginasColor.toLocaleString()}`, 14, startY + 26);
    doc.text(`Promedio por Impresora: ${filteredImpresoras.length > 0 ? Math.round(totalPaginas / filteredImpresoras.length).toLocaleString() : 0}`, 14, startY + 32);

    // Printers table
    doc.setFontSize(12);
    doc.setTextColor(40, 40, 40);
    doc.text('Detalle por Impresora', 14, startY + 44);

    const printerTableData = filteredImpresoras
      .sort((a, b) => {
        const totalA = (a.contador_negro_actual - a.contador_negro_inicial) + (a.contador_color_actual - a.contador_color_inicial);
        const totalB = (b.contador_negro_actual - b.contador_negro_inicial) + (b.contador_color_actual - b.contador_color_inicial);
        return totalB - totalA;
      })
      .map(imp => [
        imp.nombre,
        imp.modelo,
        imp.serie,
        (imp.contador_negro_actual - imp.contador_negro_inicial).toLocaleString(),
        (imp.contador_color_actual - imp.contador_color_inicial).toLocaleString(),
        ((imp.contador_negro_actual - imp.contador_negro_inicial) + (imp.contador_color_actual - imp.contador_color_inicial)).toLocaleString(),
      ]);

    autoTable(doc, {
      startY: startY + 50,
      head: [['Nombre', 'Modelo', 'Serie', 'Pág. B/N', 'Pág. Color', 'Total']],
      body: printerTableData,
      theme: 'striped',
      headStyles: { fillColor: [59, 130, 246], textColor: 255 },
      styles: { fontSize: 8 },
      columnStyles: {
        0: { cellWidth: 35 },
        1: { cellWidth: 30 },
        2: { cellWidth: 25 },
        3: { cellWidth: 25, halign: 'right' },
        4: { cellWidth: 25, halign: 'right' },
        5: { cellWidth: 25, halign: 'right' },
      },
    });

    // Parts section on new page
    doc.addPage();
    const partsY = addPDFHeader(doc, 'Estado de Piezas');
    
    doc.setFontSize(10);
    doc.setTextColor(60, 60, 60);
    doc.text(`Total de Piezas Activas: ${piezas.length}`, 14, partsY);
    doc.text(`Piezas con Alerta (>70%): ${piezas.filter(p => p.porcentaje_usado >= 70).length}`, 14, partsY + 6);
    doc.text(`Piezas Críticas (>90%): ${piezas.filter(p => p.porcentaje_usado >= 90).length}`, 14, partsY + 12);

    const piezasTableData = piezas
      .sort((a, b) => b.porcentaje_usado - a.porcentaje_usado)
      .map(p => [
        TIPO_PIEZA_LABELS[p.tipo_pieza] || p.tipo_pieza,
        p.nombre_pieza,
        p.impresora_nombre,
        p.vida_util_estimada.toLocaleString(),
        `${p.porcentaje_usado.toFixed(1)}%`,
        p.porcentaje_usado >= 90 ? 'Crítico' : p.porcentaje_usado >= 70 ? 'Advertencia' : 'OK',
      ]);

    autoTable(doc, {
      startY: partsY + 18,
      head: [['Tipo', 'Nombre', 'Impresora', 'Vida Útil', '% Usado', 'Estado']],
      body: piezasTableData,
      theme: 'striped',
      headStyles: { fillColor: [59, 130, 246], textColor: 255 },
      styles: { fontSize: 8 },
      columnStyles: {
        0: { cellWidth: 30 },
        1: { cellWidth: 35 },
        2: { cellWidth: 35 },
        3: { cellWidth: 25, halign: 'right' },
        4: { cellWidth: 20, halign: 'right' },
        5: { cellWidth: 20, halign: 'center' },
      },
      didParseCell: (data) => {
        if (data.column.index === 5 && data.section === 'body') {
          const value = data.cell.raw as string;
          if (value === 'Crítico') {
            data.cell.styles.textColor = [220, 38, 38];
            data.cell.styles.fontStyle = 'bold';
          } else if (value === 'Advertencia') {
            data.cell.styles.textColor = [234, 179, 8];
            data.cell.styles.fontStyle = 'bold';
          } else {
            data.cell.styles.textColor = [34, 197, 94];
          }
        }
      },
    });

    addPDFPageNumbers(doc);
    doc.save(`informe_consumo_${new Date().toISOString().split('T')[0]}.pdf`);
    toast({ title: 'PDF Generado', description: 'El informe ha sido descargado correctamente.' });
  };

  const exportToCSV = () => {
    const data = filteredImpresoras.map(imp => ({
      Nombre: imp.nombre,
      Serie: imp.serie,
      Modelo: imp.modelo,
      Tipo: imp.tipo_impresion,
      PaginasNegro: imp.contador_negro_actual - imp.contador_negro_inicial,
      PaginasColor: imp.contador_color_actual - imp.contador_color_inicial,
      Total: (imp.contador_negro_actual - imp.contador_negro_inicial) + (imp.contador_color_actual - imp.contador_color_inicial),
    }));

    const headers = Object.keys(data[0] || {}).join(',');
    const rows = data.map(row => Object.values(row).map(v => `"${v}"`).join(',')).join('\n');
    const csv = `${headers}\n${rows}`;
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `informe_impresoras_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    
    toast({ title: 'Exportado', description: 'El archivo CSV ha sido descargado.' });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <BarChart3 className="w-7 h-7 text-primary" />
              </div>
              Informes y Estadísticas
            </h1>
            <p className="text-muted-foreground mt-1">
              Análisis de consumo basado en contadores de páginas
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={exportToCSV} variant="outline" className="gap-2">
              <Download className="w-4 h-4" />
              Exportar CSV
            </Button>
            <Button onClick={exportToPDF} className="gap-2">
              <FileText className="w-4 h-4" />
              Exportar PDF
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <Filter className="w-5 h-5" />
              Filtros
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label className="text-sm">Sector</Label>
                <Select value={filterSector} onValueChange={setFilterSector}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover">
                    <SelectItem value="all">Todos los sectores</SelectItem>
                    {sectores.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.nombre}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label className="text-sm">Filial</Label>
                <Select value={filterFilial} onValueChange={setFilterFilial}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover">
                    <SelectItem value="all">Todas las filiales</SelectItem>
                    {filiales.map(f => (
                      <SelectItem key={f.id} value={f.id}>{f.nombre}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label className="text-sm">Desde</Label>
                <Input
                  type="date"
                  value={filterDateFrom}
                  onChange={e => setFilterDateFrom(e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <Label className="text-sm">Hasta</Label>
                <Input
                  type="date"
                  value={filterDateTo}
                  onChange={e => setFilterDateTo(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* Stats Summary */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <Card className="hover-lift">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-primary/10">
                      <FileText className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total Páginas</p>
                      <p className="text-2xl font-bold">{totalPaginas.toLocaleString()}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="hover-lift">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-muted">
                      <Printer className="w-6 h-6 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Páginas B/N</p>
                      <p className="text-2xl font-bold">{totalPaginasNegro.toLocaleString()}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="hover-lift">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-info/10">
                      <PieChart className="w-6 h-6 text-info" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Páginas Color</p>
                      <p className="text-2xl font-bold">{totalPaginasColor.toLocaleString()}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="hover-lift">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-success/10">
                      <TrendingUp className="w-6 h-6 text-success" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Promedio/Imp.</p>
                      <p className="text-2xl font-bold">
                        {filteredImpresoras.length > 0 
                          ? Math.round(totalPaginas / filteredImpresoras.length).toLocaleString()
                          : 0
                        }
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="hover-lift">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-warning/10">
                      <Wrench className="w-6 h-6 text-warning" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Piezas Alerta</p>
                      <p className="text-2xl font-bold">{piezas.filter(p => p.porcentaje_usado >= 70).length}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Bar Chart - Pages by Printer */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-primary" />
                    Páginas por Impresora
                  </CardTitle>
                  <CardDescription>Top 10 impresoras con mayor consumo</CardDescription>
                </CardHeader>
                <CardContent>
                  {printerChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={printerChartData} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis type="number" stroke="hsl(var(--muted-foreground))" />
                        <YAxis 
                          dataKey="name" 
                          type="category" 
                          width={100} 
                          stroke="hsl(var(--muted-foreground))"
                          tick={{ fontSize: 12 }}
                        />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: 'hsl(var(--popover))', 
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px'
                          }}
                        />
                        <Bar dataKey="negro" stackId="a" fill="hsl(var(--muted-foreground))" name="B/N" />
                        <Bar dataKey="color" stackId="a" fill="hsl(var(--primary))" name="Color" />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                      No hay datos disponibles
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Pie Chart - B/N vs Color */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <PieChart className="w-5 h-5 text-primary" />
                    Distribución B/N vs Color
                  </CardTitle>
                  <CardDescription>Proporción de páginas impresas</CardDescription>
                </CardHeader>
                <CardContent>
                  {pieData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <RechartsPie>
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={100}
                          paddingAngle={5}
                          dataKey="value"
                          label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        >
                          {pieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: 'hsl(var(--popover))', 
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px'
                          }}
                          formatter={(value: number) => value.toLocaleString()}
                        />
                        <Legend />
                      </RechartsPie>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                      No hay datos disponibles
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Table */}
            <Card>
              <CardHeader>
                <CardTitle>Detalle por Impresora</CardTitle>
                <CardDescription>
                  {filteredImpresoras.length} impresoras en el análisis
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Impresora</TableHead>
                        <TableHead>Modelo</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead className="text-right">Páginas B/N</TableHead>
                        <TableHead className="text-right">Páginas Color</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredImpresoras
                        .sort((a, b) => {
                          const totalA = (a.contador_negro_actual - a.contador_negro_inicial) + (a.contador_color_actual - a.contador_color_inicial);
                          const totalB = (b.contador_negro_actual - b.contador_negro_inicial) + (b.contador_color_actual - b.contador_color_inicial);
                          return totalB - totalA;
                        })
                        .map(imp => {
                          const paginasNegro = imp.contador_negro_actual - imp.contador_negro_inicial;
                          const paginasColor = imp.contador_color_actual - imp.contador_color_inicial;
                          const total = paginasNegro + paginasColor;

                          return (
                            <TableRow key={imp.id}>
                              <TableCell>
                                <div>
                                  <span className="font-medium">{imp.nombre}</span>
                                  <p className="text-xs text-muted-foreground">{imp.serie}</p>
                                </div>
                              </TableCell>
                              <TableCell>{imp.modelo}</TableCell>
                              <TableCell>
                                <Badge variant="outline">
                                  {imp.tipo_impresion === 'monocromatico' ? 'B/N' : 'Color'}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right font-mono">
                                {paginasNegro.toLocaleString()}
                              </TableCell>
                              <TableCell className="text-right font-mono">
                                {paginasColor.toLocaleString()}
                              </TableCell>
                              <TableCell className="text-right font-mono font-semibold">
                                {total.toLocaleString()}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
