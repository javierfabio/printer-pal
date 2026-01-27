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
  Calendar
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart as RechartsPie, Pie, Cell, Legend } from 'recharts';

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

const COLORS = ['hsl(221, 83%, 53%)', 'hsl(142, 76%, 36%)', 'hsl(38, 92%, 50%)', 'hsl(0, 84%, 60%)', 'hsl(262, 83%, 58%)'];

export default function Informes() {
  const { role } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [impresoras, setImpresoras] = useState<Impresora[]>([]);
  const [sectores, setSectores] = useState<Sector[]>([]);
  const [filiales, setFiliales] = useState<Filial[]>([]);
  
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
    
    const [impResp, secResp, filResp] = await Promise.all([
      supabase.from('impresoras').select('*').eq('estado', 'activa'),
      supabase.from('sectores').select('*').eq('activo', true),
      supabase.from('filiales').select('*').eq('activo', true),
    ]);

    if (impResp.data) setImpresoras(impResp.data);
    if (secResp.data) setSectores(secResp.data);
    if (filResp.data) setFiliales(filResp.data);
    
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
    toast({ title: 'Exportación', description: 'Función de exportación a PDF próximamente disponible.' });
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
            <Button onClick={exportToPDF} variant="outline" className="gap-2">
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
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
                      <p className="text-sm text-muted-foreground">Promedio/Impresora</p>
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
                            <TableRow key={imp.id} className="hover:bg-muted/50">
                              <TableCell>
                                <div>
                                  <span className="font-medium">{imp.nombre}</span>
                                  <br />
                                  <span className="text-xs text-muted-foreground font-mono">{imp.serie}</span>
                                </div>
                              </TableCell>
                              <TableCell>{imp.modelo}</TableCell>
                              <TableCell>
                                <Badge variant="outline" className="capitalize">
                                  {imp.tipo_impresion}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right font-medium">
                                {paginasNegro.toLocaleString()}
                              </TableCell>
                              <TableCell className="text-right font-medium">
                                {paginasColor.toLocaleString()}
                              </TableCell>
                              <TableCell className="text-right font-bold text-primary">
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
