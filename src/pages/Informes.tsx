import { useEffect, useState, useMemo } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  BarChart3, Download, Filter, Loader2, Printer, TrendingUp, FileText, PieChart, Wrench, XCircle, ArrowUpDown, User, Search
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart as RechartsPie, Pie, Cell, Legend } from 'recharts';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { addPDFHeader, addPDFPageNumbers } from '@/lib/pdfHeader';
import { RecentReadingsPeriodTable } from '@/components/informes/RecentReadingsPeriodTable';

interface Impresora { id: string; nombre: string; serie: string; modelo: string; tipo_impresion: string; contador_negro_actual: number; contador_color_actual: number; contador_negro_inicial: number; contador_color_inicial: number; sector_id: string | null; filial_id: string | null; }
interface Sector { id: string; nombre: string; }
interface Filial { id: string; nombre: string; }
interface Profile { id: string; full_name: string | null; email: string; }
interface PiezaInfo { id: string; nombre_pieza: string; tipo_pieza: string; vida_util_estimada: number; porcentaje_usado: number; impresora_nombre: string; impresora_serie: string; impresora_id: string; contador_instalacion: number; consumoDesdeCarga: number; }
interface LecturaInfo { id: string; fecha_lectura: string; contador_negro: number | null; contador_color: number | null; registrado_por: string; impresora_id: string; impresoras?: { nombre: string; serie: string }; }

const COLORS = ['hsl(221, 83%, 53%)', 'hsl(142, 76%, 36%)', 'hsl(38, 92%, 50%)', 'hsl(0, 84%, 60%)', 'hsl(262, 83%, 58%)'];
const TIPO_PIEZA_LABELS: Record<string, string> = { toner_negro: 'Tóner Negro', toner_color: 'Tóner Color', fusor: 'Fusor', unidad_imagen: 'Unidad de Imagen', malla: 'Malla / Mesh', transfer_belt: 'Transfer Belt', rodillo: 'Rodillo', otro: 'Otra Pieza' };

export default function Informes() {
  const { role } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [impresoras, setImpresoras] = useState<Impresora[]>([]);
  const [sectores, setSectores] = useState<Sector[]>([]);
  const [filiales, setFiliales] = useState<Filial[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [piezas, setPiezas] = useState<PiezaInfo[]>([]);
  const [lecturas, setLecturas] = useState<LecturaInfo[]>([]);

  const [filterFilial, setFilterFilial] = useState<string>('all');
  const [filterSector, setFilterSector] = useState<string>('all');
  const [filterModelo, setFilterModelo] = useState<string>('all');
  const [filterPrinter, setFilterPrinter] = useState<string>('all');
  const [filterDateFrom, setFilterDateFrom] = useState<string>('');
  const [filterDateTo, setFilterDateTo] = useState<string>('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [globalSearch, setGlobalSearch] = useState('');

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    const [impResp, secResp, filResp, piezasResp, profResp, lecResp] = await Promise.all([
      supabase.from('impresoras').select('*').eq('estado', 'activa'),
      supabase.from('sectores').select('*').eq('activo', true),
      supabase.from('filiales').select('*').eq('activo', true),
      supabase.from('piezas_impresora').select('*, impresoras(nombre, serie, contador_negro_actual, contador_color_actual)').eq('activo', true),
      supabase.from('profiles').select('id, full_name, email'),
      supabase.from('lecturas_contadores').select('*, impresoras(nombre, serie)').order('fecha_lectura', { ascending: false }).limit(200),
    ]);
    if (impResp.data) setImpresoras(impResp.data);
    if (secResp.data) setSectores(secResp.data);
    if (filResp.data) setFiliales(filResp.data);
    if (profResp.data) setProfiles(profResp.data as Profile[]);
    if (lecResp.data) setLecturas(lecResp.data as LecturaInfo[]);
    if (piezasResp.data) {
      setPiezas(piezasResp.data.map((p: any) => {
        const contadorActual = (p.impresoras?.contador_negro_actual || 0) + (p.impresoras?.contador_color_actual || 0);
        const consumoDesdeCarga = contadorActual - p.contador_instalacion + p.paginas_consumidas;
        return {
          id: p.id, nombre_pieza: p.nombre_pieza, tipo_pieza: p.tipo_pieza,
          vida_util_estimada: p.vida_util_estimada,
          porcentaje_usado: Math.min(100, (consumoDesdeCarga / p.vida_util_estimada) * 100),
          impresora_nombre: p.impresoras?.nombre || '', impresora_serie: p.impresoras?.serie || '',
          impresora_id: p.impresora_id, contador_instalacion: p.contador_instalacion,
          consumoDesdeCarga,
        };
      }));
    }
    setLoading(false);
  };

  const getProfileName = (userId: string | null) => { if (!userId) return 'Desconocido'; const p = profiles.find(pr => pr.id === userId); return p?.full_name || p?.email || userId.slice(0, 8); };
  const getSectorName = (id: string | null) => sectores.find(s => s.id === id)?.nombre || '-';
  const getFilialName = (id: string | null) => filiales.find(f => f.id === id)?.nombre || '-';

  // Global search filter
  const searchFilteredImpresoras = useMemo(() => {
    if (!globalSearch) return impresoras;
    const q = globalSearch.toLowerCase();
    return impresoras.filter(imp =>
      imp.nombre.toLowerCase().includes(q) || imp.serie.toLowerCase().includes(q) ||
      imp.modelo.toLowerCase().includes(q) ||
      getFilialName(imp.filial_id).toLowerCase().includes(q) ||
      getSectorName(imp.sector_id).toLowerCase().includes(q)
    );
  }, [globalSearch, impresoras, sectores, filiales]);

  // Cascade filters
  const filteredSectores = useMemo(() => {
    if (filterFilial === 'all') return sectores;
    const sectorIds = new Set(searchFilteredImpresoras.filter(p => p.filial_id === filterFilial).map(p => p.sector_id).filter(Boolean));
    return sectores.filter(s => sectorIds.has(s.id));
  }, [filterFilial, sectores, searchFilteredImpresoras]);

  const filteredModelos = useMemo(() => {
    let f = searchFilteredImpresoras;
    if (filterFilial !== 'all') f = f.filter(p => p.filial_id === filterFilial);
    if (filterSector !== 'all') f = f.filter(p => p.sector_id === filterSector);
    return [...new Set(f.map(p => p.modelo))].sort();
  }, [filterFilial, filterSector, searchFilteredImpresoras]);

  const filteredPrinterList = useMemo(() => {
    let f = searchFilteredImpresoras;
    if (filterFilial !== 'all') f = f.filter(p => p.filial_id === filterFilial);
    if (filterSector !== 'all') f = f.filter(p => p.sector_id === filterSector);
    if (filterModelo !== 'all') f = f.filter(p => p.modelo === filterModelo);
    return f;
  }, [filterFilial, filterSector, filterModelo, searchFilteredImpresoras]);

  const filteredImpresoras = useMemo(() => {
    let f = filteredPrinterList;
    if (filterPrinter !== 'all') f = f.filter(p => p.id === filterPrinter);
    return f;
  }, [filteredPrinterList, filterPrinter]);

  const filteredPrinterIds = new Set(filteredImpresoras.map(i => i.id));

  const sortedImpresoras = [...filteredImpresoras].sort((a, b) => {
    const totalA = (a.contador_negro_actual - a.contador_negro_inicial) + (a.contador_color_actual - a.contador_color_inicial);
    const totalB = (b.contador_negro_actual - b.contador_negro_inicial) + (b.contador_color_actual - b.contador_color_inicial);
    return sortOrder === 'asc' ? totalA - totalB : totalB - totalA;
  });

  const totalPaginasNegro = filteredImpresoras.reduce((acc, imp) => acc + (imp.contador_negro_actual - imp.contador_negro_inicial), 0);
  const totalPaginasColor = filteredImpresoras.reduce((acc, imp) => acc + (imp.contador_color_actual - imp.contador_color_inicial), 0);
  const totalPaginas = totalPaginasNegro + totalPaginasColor;

  const printerChartData = sortedImpresoras.map(imp => ({
    name: imp.nombre.length > 15 ? imp.nombre.substring(0, 15) + '...' : imp.nombre,
    negro: imp.contador_negro_actual - imp.contador_negro_inicial,
    color: imp.contador_color_actual - imp.contador_color_inicial,
  })).slice(0, 10);

  const pieData = [{ name: 'Blanco y Negro', value: totalPaginasNegro }, { name: 'Color', value: totalPaginasColor }].filter(d => d.value > 0);
  const filteredPiezas = piezas.filter(p => filteredPrinterIds.has(p.impresora_id));

  const clearFilters = () => { setFilterFilial('all'); setFilterSector('all'); setFilterModelo('all'); setFilterPrinter('all'); setFilterDateFrom(''); setFilterDateTo(''); setSortOrder('desc'); setGlobalSearch(''); };
  const hasActiveFilters = filterFilial !== 'all' || filterSector !== 'all' || filterModelo !== 'all' || filterPrinter !== 'all' || filterDateFrom || filterDateTo || globalSearch;

  const exportToPDF = () => {
    const doc = new jsPDF('landscape');
    let startY = addPDFHeader(doc, 'Informe General de Uso');
    doc.setFontSize(10); doc.setTextColor(60, 60, 60);
    doc.text(`Total Impresoras: ${filteredImpresoras.length} | Páginas: ${totalPaginas.toLocaleString()} | B/N: ${totalPaginasNegro.toLocaleString()} | Color: ${totalPaginasColor.toLocaleString()}`, 14, startY);

    autoTable(doc, {
      startY: startY + 6,
      head: [['Filial', 'Sector', 'Modelo', 'Serie', 'Nombre', 'Pág. B/N', 'Pág. Color', 'Total']],
      body: sortedImpresoras.map(imp => [getFilialName(imp.filial_id), getSectorName(imp.sector_id), imp.modelo, imp.serie, imp.nombre, (imp.contador_negro_actual - imp.contador_negro_inicial).toLocaleString(), (imp.contador_color_actual - imp.contador_color_inicial).toLocaleString(), ((imp.contador_negro_actual - imp.contador_negro_inicial) + (imp.contador_color_actual - imp.contador_color_inicial)).toLocaleString()]),
      theme: 'striped', headStyles: { fillColor: [59, 130, 246], textColor: 255 }, styles: { fontSize: 7 },
    });

    // Parts page with consumption from load
    doc.addPage();
    const partsY = addPDFHeader(doc, 'Estado de Piezas - Consumo desde Última Carga');
    autoTable(doc, {
      startY: partsY,
      head: [['Tipo', 'Nombre', 'Impresora', 'Vida Útil', 'Consumo desde Carga', '% Usado', 'Estado']],
      body: filteredPiezas.sort((a, b) => b.porcentaje_usado - a.porcentaje_usado).map(p => [TIPO_PIEZA_LABELS[p.tipo_pieza] || p.tipo_pieza, p.nombre_pieza, p.impresora_nombre, p.vida_util_estimada.toLocaleString(), p.consumoDesdeCarga.toLocaleString(), `${p.porcentaje_usado.toFixed(1)}%`, p.porcentaje_usado >= 90 ? 'Crítico' : p.porcentaje_usado >= 70 ? 'Advertencia' : 'OK']),
      theme: 'striped', headStyles: { fillColor: [59, 130, 246], textColor: 255 }, styles: { fontSize: 8 },
    });

    addPDFPageNumbers(doc);
    doc.save(`informe_consumo_${new Date().toISOString().split('T')[0]}.pdf`);
    toast({ title: 'PDF Generado' });
  };

  const exportToCSV = () => {
    const data = sortedImpresoras.map(imp => ({
      Nombre: imp.nombre, Serie: imp.serie, Modelo: imp.modelo, Tipo: imp.tipo_impresion,
      Filial: getFilialName(imp.filial_id), Sector: getSectorName(imp.sector_id),
      PaginasNegro: imp.contador_negro_actual - imp.contador_negro_inicial,
      PaginasColor: imp.contador_color_actual - imp.contador_color_inicial,
      Total: (imp.contador_negro_actual - imp.contador_negro_inicial) + (imp.contador_color_actual - imp.contador_color_inicial),
    }));
    if (data.length === 0) return;
    const headers = Object.keys(data[0]).join(',');
    const rows = data.map(row => Object.values(row).map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob([`${headers}\n${rows}`], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `informe_impresoras_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    toast({ title: 'Exportado' });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3"><div className="p-2 rounded-lg bg-primary/10"><BarChart3 className="w-7 h-7 text-primary" /></div>Informes y Estadísticas</h1>
            <p className="text-muted-foreground mt-1">Análisis con filtros Filial → Sector → Modelo → Impresora</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={exportToCSV} variant="outline" className="gap-2"><Download className="w-4 h-4" />CSV/Excel</Button>
            <Button onClick={exportToPDF} className="gap-2"><FileText className="w-4 h-4" />PDF</Button>
          </div>
        </div>

        {/* Global Search */}
        <Card>
          <CardContent className="pt-6">
            <div className="relative max-w-lg">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Buscar por filial, sector, modelo o número de serie..." value={globalSearch} onChange={e => setGlobalSearch(e.target.value)} className="pl-9" />
            </div>
          </CardContent>
        </Card>

        {/* Cascade Filters */}
        <Card>
          <CardHeader className="pb-4"><CardTitle className="text-lg flex items-center gap-2"><Filter className="w-5 h-5" />Filtros (Filial → Sector → Modelo → Impresora)</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
              <div className="space-y-2">
                <Label className="text-sm">Filial</Label>
                <Select value={filterFilial} onValueChange={v => { setFilterFilial(v); setFilterSector('all'); setFilterModelo('all'); setFilterPrinter('all'); }}>
                  <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
                  <SelectContent className="bg-popover"><SelectItem value="all">Todas las filiales</SelectItem>{filiales.map(f => <SelectItem key={f.id} value={f.id}>{f.nombre}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-sm">Sector</Label>
                <Select value={filterSector} onValueChange={v => { setFilterSector(v); setFilterModelo('all'); setFilterPrinter('all'); }}>
                  <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                  <SelectContent className="bg-popover"><SelectItem value="all">Todos los sectores</SelectItem>{filteredSectores.map(s => <SelectItem key={s.id} value={s.id}>{s.nombre}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-sm">Modelo</Label>
                <Select value={filterModelo} onValueChange={v => { setFilterModelo(v); setFilterPrinter('all'); }}>
                  <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                  <SelectContent className="bg-popover"><SelectItem value="all">Todos</SelectItem>{filteredModelos.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-sm">Impresora</Label>
                <Select value={filterPrinter} onValueChange={setFilterPrinter}>
                  <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
                  <SelectContent className="bg-popover"><SelectItem value="all">Todas</SelectItem>{filteredPrinterList.map(p => <SelectItem key={p.id} value={p.id}>{p.nombre} ({p.serie})</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label className="text-sm">Desde</Label><Input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} /></div>
              <div className="space-y-2"><Label className="text-sm">Hasta</Label><Input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} /></div>
            </div>
            <div className="flex justify-between items-center mt-4">
              <Button variant="outline" size="sm" className="gap-2" onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}><ArrowUpDown className="w-4 h-4" />{sortOrder === 'desc' ? 'Mayor a menor' : 'Menor a mayor'}</Button>
              {hasActiveFilters && <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-2 text-destructive hover:text-destructive"><XCircle className="w-4 h-4" />Borrar filtros</Button>}
            </div>
          </CardContent>
        </Card>

        {loading ? <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div> : (
          <>
            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <Card className="hover-lift"><CardContent className="pt-6"><div className="flex items-center gap-4"><div className="p-3 rounded-xl bg-primary/10"><FileText className="w-6 h-6 text-primary" /></div><div><p className="text-sm text-muted-foreground">Total Páginas</p><p className="text-2xl font-bold">{totalPaginas.toLocaleString()}</p></div></div></CardContent></Card>
              <Card className="hover-lift"><CardContent className="pt-6"><div className="flex items-center gap-4"><div className="p-3 rounded-xl bg-muted"><Printer className="w-6 h-6 text-muted-foreground" /></div><div><p className="text-sm text-muted-foreground">Páginas B/N</p><p className="text-2xl font-bold">{totalPaginasNegro.toLocaleString()}</p></div></div></CardContent></Card>
              <Card className="hover-lift"><CardContent className="pt-6"><div className="flex items-center gap-4"><div className="p-3 rounded-xl bg-info/10"><PieChart className="w-6 h-6 text-info" /></div><div><p className="text-sm text-muted-foreground">Páginas Color</p><p className="text-2xl font-bold">{totalPaginasColor.toLocaleString()}</p></div></div></CardContent></Card>
              <Card className="hover-lift"><CardContent className="pt-6"><div className="flex items-center gap-4"><div className="p-3 rounded-xl bg-success/10"><TrendingUp className="w-6 h-6 text-success" /></div><div><p className="text-sm text-muted-foreground">Promedio/Imp.</p><p className="text-2xl font-bold">{filteredImpresoras.length > 0 ? Math.round(totalPaginas / filteredImpresoras.length).toLocaleString() : 0}</p></div></div></CardContent></Card>
              <Card className="hover-lift"><CardContent className="pt-6"><div className="flex items-center gap-4"><div className="p-3 rounded-xl bg-warning/10"><Wrench className="w-6 h-6 text-warning" /></div><div><p className="text-sm text-muted-foreground">Piezas Alerta</p><p className="text-2xl font-bold">{filteredPiezas.filter(p => p.porcentaje_usado >= 70).length}</p></div></div></CardContent></Card>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><BarChart3 className="w-5 h-5 text-primary" />Páginas por Impresora</CardTitle></CardHeader>
                <CardContent>
                  {printerChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={printerChartData} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis type="number" stroke="hsl(var(--muted-foreground))" />
                        <YAxis dataKey="name" type="category" width={100} stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 12 }} />
                        <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
                        <Bar dataKey="negro" stackId="a" fill="hsl(var(--muted-foreground))" name="B/N" />
                        <Bar dataKey="color" stackId="a" fill="hsl(var(--primary))" name="Color" />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : <div className="h-[300px] flex items-center justify-center text-muted-foreground">No hay datos</div>}
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><PieChart className="w-5 h-5 text-primary" />Distribución B/N vs Color</CardTitle></CardHeader>
                <CardContent>
                  {pieData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <RechartsPie><Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={5} dataKey="value" label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}>{pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie><Tooltip contentStyle={{ backgroundColor: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} formatter={(v: number) => v.toLocaleString()} /><Legend /></RechartsPie>
                    </ResponsiveContainer>
                  ) : <div className="h-[300px] flex items-center justify-center text-muted-foreground">No hay datos</div>}
                </CardContent>
              </Card>
            </div>

            {/* Detail Table */}
            <Card>
              <CardHeader><CardTitle>Detalle por Impresora</CardTitle><CardDescription>{filteredImpresoras.length} impresoras</CardDescription></CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader><TableRow><TableHead>Impresora</TableHead><TableHead>Modelo</TableHead><TableHead>Filial</TableHead><TableHead>Sector</TableHead><TableHead>Tipo</TableHead><TableHead className="text-right">Pág. B/N</TableHead><TableHead className="text-right">Pág. Color</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {sortedImpresoras.map(imp => {
                        const pN = imp.contador_negro_actual - imp.contador_negro_inicial;
                        const pC = imp.contador_color_actual - imp.contador_color_inicial;
                        return (
                          <TableRow key={imp.id}>
                            <TableCell><div><span className="font-medium">{imp.nombre}</span><p className="text-xs text-muted-foreground">{imp.serie}</p></div></TableCell>
                            <TableCell>{imp.modelo}</TableCell>
                            <TableCell className="text-muted-foreground">{getFilialName(imp.filial_id)}</TableCell>
                            <TableCell className="text-muted-foreground">{getSectorName(imp.sector_id)}</TableCell>
                            <TableCell><Badge variant="outline">{imp.tipo_impresion === 'monocromatico' ? 'B/N' : 'Color'}</Badge></TableCell>
                            <TableCell className="text-right font-mono">{pN.toLocaleString()}</TableCell>
                            <TableCell className="text-right font-mono">{pC.toLocaleString()}</TableCell>
                            <TableCell className="text-right font-mono font-semibold">{(pN + pC).toLocaleString()}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            {/* Pieces with Consumption from Load */}
            {filteredPiezas.length > 0 && (
              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><Wrench className="w-5 h-5 text-primary" />Consumo desde Última Carga de Pieza</CardTitle></CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader><TableRow><TableHead>Pieza</TableHead><TableHead>Impresora</TableHead><TableHead className="text-right">Vida Útil</TableHead><TableHead className="text-right">Consumo desde Carga</TableHead><TableHead className="text-right">% Usado</TableHead><TableHead>Estado</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {filteredPiezas.sort((a, b) => b.porcentaje_usado - a.porcentaje_usado).map(p => (
                          <TableRow key={p.id}>
                            <TableCell className="font-medium">{p.nombre_pieza}<p className="text-xs text-muted-foreground">{TIPO_PIEZA_LABELS[p.tipo_pieza] || p.tipo_pieza}</p></TableCell>
                            <TableCell>{p.impresora_nombre}<p className="text-xs text-muted-foreground">{p.impresora_serie}</p></TableCell>
                            <TableCell className="text-right font-mono">{p.vida_util_estimada.toLocaleString()}</TableCell>
                            <TableCell className="text-right font-mono font-semibold">{p.consumoDesdeCarga.toLocaleString()}</TableCell>
                            <TableCell className="text-right font-mono">{p.porcentaje_usado.toFixed(1)}%</TableCell>
                            <TableCell>
                              <Badge variant={p.porcentaje_usado >= 90 ? 'destructive' : p.porcentaje_usado >= 70 ? 'secondary' : 'outline'}>
                                {p.porcentaje_usado >= 90 ? 'Crítico' : p.porcentaje_usado >= 70 ? 'Advertencia' : 'OK'}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}

            <RecentReadingsPeriodTable
              lecturas={lecturas}
              filteredPrinterIds={filteredPrinterIds}
              getProfileName={getProfileName}
            />
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
