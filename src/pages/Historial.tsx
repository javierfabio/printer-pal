import { useEffect, useState, useMemo } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { 
  History as HistoryIcon, Search, Filter, Download, Calendar, Printer, User, ArrowRight, Loader2, FileText, Wrench, XCircle, ArrowUpDown
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { addPDFHeader, addPDFPageNumbers } from '@/lib/pdfHeader';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface HistorialItem { id: string; created_at: string; campo_modificado: string; valor_anterior: string | null; valor_nuevo: string | null; motivo: string | null; impresora_id: string; usuario_id: string; impresoras?: { nombre: string; serie: string }; }
interface LecturaHistorial { id: string; fecha_lectura: string; contador_negro: number | null; contador_color: number | null; notas: string | null; impresora_id: string; registrado_por: string; impresoras?: { nombre: string; serie: string }; }
interface PiezaHistorial { id: string; fecha_cambio: string; nombre_pieza: string; tipo_pieza: string; vida_util_estimada: number; vida_util_real: number | null; porcentaje_vida_consumida: number | null; contador_cambio: number; motivo: string | null; observaciones: string | null; impresora_id: string; tecnico_id: string | null; impresoras?: { nombre: string; serie: string }; }
interface Profile { id: string; full_name: string | null; email: string; }
interface PrinterFull { id: string; nombre: string; serie: string; modelo: string; sector_id: string | null; filial_id: string | null; }
interface Sector { id: string; nombre: string; }
interface Filial { id: string; nombre: string; }

export default function Historial() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [historial, setHistorial] = useState<HistorialItem[]>([]);
  const [piezas, setPiezas] = useState<PiezaHistorial[]>([]);
  const [lecturas, setLecturas] = useState<LecturaHistorial[]>([]);
  const [impresoras, setImpresoras] = useState<PrinterFull[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [sectores, setSectores] = useState<Sector[]>([]);
  const [filiales, setFiliales] = useState<Filial[]>([]);
  
  const [filterFilial, setFilterFilial] = useState<string>('all');
  const [filterSector, setFilterSector] = useState<string>('all');
  const [filterModelo, setFilterModelo] = useState<string>('all');
  const [filterPrinter, setFilterPrinter] = useState<string>('all');
  const [filterDateFrom, setFilterDateFrom] = useState<string>('');
  const [filterDateTo, setFilterDateTo] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [activeTab, setActiveTab] = useState<'lecturas' | 'cambios' | 'piezas'>('lecturas');

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    const [histResp, lecResp, piezasResp, impResp, profResp, secResp, filResp] = await Promise.all([
      supabase.from('historial_cambios').select('*, impresoras(nombre, serie)').order('created_at', { ascending: false }).limit(500),
      supabase.from('lecturas_contadores').select('*, impresoras(nombre, serie)').order('fecha_lectura', { ascending: false }).limit(500),
      supabase.from('historial_piezas').select('*, impresoras(nombre, serie)').order('fecha_cambio', { ascending: false }).limit(500),
      supabase.from('impresoras').select('id, nombre, serie, modelo, sector_id, filial_id').order('nombre'),
      supabase.from('profiles').select('id, full_name, email'),
      supabase.from('sectores').select('id, nombre').eq('activo', true),
      supabase.from('filiales').select('id, nombre').eq('activo', true),
    ]);
    if (histResp.data) setHistorial(histResp.data as HistorialItem[]);
    if (lecResp.data) setLecturas(lecResp.data as LecturaHistorial[]);
    if (piezasResp.data) setPiezas(piezasResp.data as PiezaHistorial[]);
    if (impResp.data) setImpresoras(impResp.data as PrinterFull[]);
    if (profResp.data) setProfiles(profResp.data as Profile[]);
    if (secResp.data) setSectores(secResp.data);
    if (filResp.data) setFiliales(filResp.data);
    setLoading(false);
  };

  const getProfileName = (userId: string | null) => {
    if (!userId) return 'Desconocido';
    const p = profiles.find(pr => pr.id === userId);
    return p?.full_name || p?.email || userId.slice(0, 8);
  };

  const getFilialName = (id: string | null) => filiales.find(f => f.id === id)?.nombre || '-';
  const getSectorName = (id: string | null) => sectores.find(s => s.id === id)?.nombre || '-';
  const getPrinterInfo = (printerId: string) => impresoras.find(p => p.id === printerId);

  // Cascade filters
  const filteredSectores = useMemo(() => {
    if (filterFilial === 'all') return sectores;
    const sectorIds = new Set(impresoras.filter(p => p.filial_id === filterFilial).map(p => p.sector_id).filter(Boolean));
    return sectores.filter(s => sectorIds.has(s.id));
  }, [filterFilial, sectores, impresoras]);

  const filteredModelos = useMemo(() => {
    let filtered = impresoras;
    if (filterFilial !== 'all') filtered = filtered.filter(p => p.filial_id === filterFilial);
    if (filterSector !== 'all') filtered = filtered.filter(p => p.sector_id === filterSector);
    return [...new Set(filtered.map(p => p.modelo))].sort();
  }, [filterFilial, filterSector, impresoras]);

  const filteredPrinterList = useMemo(() => {
    let filtered = impresoras;
    if (filterFilial !== 'all') filtered = filtered.filter(p => p.filial_id === filterFilial);
    if (filterSector !== 'all') filtered = filtered.filter(p => p.sector_id === filterSector);
    if (filterModelo !== 'all') filtered = filtered.filter(p => p.modelo === filterModelo);
    return filtered;
  }, [filterFilial, filterSector, filterModelo, impresoras]);

  const allowedPrinterIds = new Set(filteredPrinterList.map(p => p.id));

  const sortByDate = <T extends Record<string, any>>(arr: T[], dateField: string): T[] => {
    return [...arr].sort((a, b) => {
      const da = new Date(a[dateField]).getTime();
      const db = new Date(b[dateField]).getTime();
      return sortOrder === 'asc' ? da - db : db - da;
    });
  };

  const matchesPrinterFilter = (printerId: string) => {
    if (filterPrinter !== 'all' && printerId !== filterPrinter) return false;
    if (!allowedPrinterIds.has(printerId)) return false;
    return true;
  };

  const matchesDateFilter = (dateStr: string) => {
    if (filterDateFrom && new Date(dateStr) < new Date(filterDateFrom)) return false;
    if (filterDateTo && new Date(dateStr) > new Date(filterDateTo + 'T23:59:59')) return false;
    return true;
  };

  const filteredLecturas = sortByDate(lecturas.filter(l => matchesPrinterFilter(l.impresora_id) && matchesDateFilter(l.fecha_lectura) && (!searchTerm || l.impresoras?.nombre?.toLowerCase().includes(searchTerm.toLowerCase()))), 'fecha_lectura');
  const filteredHistorial = sortByDate(historial.filter(h => matchesPrinterFilter(h.impresora_id) && matchesDateFilter(h.created_at) && (!searchTerm || h.impresoras?.nombre?.toLowerCase().includes(searchTerm.toLowerCase()))), 'created_at');
  const filteredPiezas = sortByDate(piezas.filter(p => matchesPrinterFilter(p.impresora_id) && matchesDateFilter(p.fecha_cambio) && (!searchTerm || p.impresoras?.nombre?.toLowerCase().includes(searchTerm.toLowerCase()))), 'fecha_cambio');

  const clearFilters = () => { setFilterFilial('all'); setFilterSector('all'); setFilterModelo('all'); setFilterPrinter('all'); setFilterDateFrom(''); setFilterDateTo(''); setSearchTerm(''); setSortOrder('desc'); };
  const hasActiveFilters = filterFilial !== 'all' || filterSector !== 'all' || filterModelo !== 'all' || filterPrinter !== 'all' || filterDateFrom || filterDateTo || searchTerm;

  const exportToCSV = () => {
    let data: Record<string, any>[] = [];
    if (activeTab === 'lecturas') {
      data = filteredLecturas.map(l => { const pi = getPrinterInfo(l.impresora_id); return { Fecha: new Date(l.fecha_lectura).toLocaleString('es'), Filial: getFilialName(pi?.filial_id || null), Sector: getSectorName(pi?.sector_id || null), Impresora: l.impresoras?.nombre || '', Modelo: pi?.modelo || '', Serie: l.impresoras?.serie || '', ContadorNegro: l.contador_negro || '', ContadorColor: l.contador_color || '', RegistradoPor: getProfileName(l.registrado_por), Notas: l.notas || '' }; });
    } else if (activeTab === 'piezas') {
      data = filteredPiezas.map(p => { const pi = getPrinterInfo(p.impresora_id); return { Fecha: new Date(p.fecha_cambio).toLocaleString('es'), Filial: getFilialName(pi?.filial_id || null), Sector: getSectorName(pi?.sector_id || null), Impresora: p.impresoras?.nombre || '', Pieza: p.nombre_pieza, Contador: p.contador_cambio, Tecnico: getProfileName(p.tecnico_id), Observacion: p.observaciones || p.motivo || '' }; });
    } else {
      data = filteredHistorial.map(h => { const pi = getPrinterInfo(h.impresora_id); return { Fecha: new Date(h.created_at).toLocaleString('es'), Filial: getFilialName(pi?.filial_id || null), Impresora: h.impresoras?.nombre || '', Campo: h.campo_modificado, Anterior: h.valor_anterior || '', Nuevo: h.valor_nuevo || '', RealizadoPor: getProfileName(h.usuario_id), Motivo: h.motivo || '' }; });
    }
    if (data.length === 0) return;
    const headers = Object.keys(data[0]).join(',');
    const rows = data.map(row => Object.values(row).map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob([`${headers}\n${rows}`], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `historial_${activeTab}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    toast({ title: 'Exportado', description: 'El archivo CSV/Excel ha sido descargado.' });
  };

  const exportToPDF = () => {
    const doc = new jsPDF('landscape');
    const tabLabels: Record<string, string> = { lecturas: 'Informe General de Uso', cambios: 'Cambios de Configuración', piezas: 'Informe de Cambio de Piezas' };
    const startY = addPDFHeader(doc, 'Historial y Auditoría', tabLabels[activeTab]);
    let head: string[][] = [];
    let body: string[][] = [];

    if (activeTab === 'lecturas') {
      head = [['Fecha', 'Filial', 'Sector', 'Impresora', 'Modelo', 'Serie', 'Negro Ant.', 'Negro Act.', 'Color Ant.', 'Color Act.', 'Uso Págs', 'Registrado Por']];
      body = filteredLecturas.map(l => { const pi = getPrinterInfo(l.impresora_id); return [new Date(l.fecha_lectura).toLocaleString('es'), getFilialName(pi?.filial_id || null), getSectorName(pi?.sector_id || null), l.impresoras?.nombre || '-', pi?.modelo || '-', l.impresoras?.serie || '-', '-', l.contador_negro?.toLocaleString() ?? '-', '-', l.contador_color?.toLocaleString() ?? '-', '-', getProfileName(l.registrado_por)]; });
    } else if (activeTab === 'piezas') {
      head = [['Fecha', 'Filial', 'Sector', 'Impresora', 'Pieza', 'Contador', 'Técnico', 'Observación']];
      body = filteredPiezas.map(p => { const pi = getPrinterInfo(p.impresora_id); return [new Date(p.fecha_cambio).toLocaleString('es'), getFilialName(pi?.filial_id || null), getSectorName(pi?.sector_id || null), p.impresoras?.nombre || '-', p.nombre_pieza, p.contador_cambio.toLocaleString(), getProfileName(p.tecnico_id), p.observaciones || p.motivo || '-']; });
    } else {
      head = [['Fecha', 'Impresora', 'Campo', 'Anterior', 'Nuevo', 'Realizado Por', 'Motivo']];
      body = filteredHistorial.map(h => [new Date(h.created_at).toLocaleString('es'), h.impresoras?.nombre || '-', h.campo_modificado, h.valor_anterior || '-', h.valor_nuevo || '-', getProfileName(h.usuario_id), h.motivo || '-']);
    }

    autoTable(doc, { startY, head, body, theme: 'striped', headStyles: { fillColor: [59, 130, 246], textColor: 255 }, styles: { fontSize: 7 } });
    addPDFPageNumbers(doc);
    doc.save(`historial_${activeTab}_${new Date().toISOString().split('T')[0]}.pdf`);
    toast({ title: 'PDF Generado' });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10"><HistoryIcon className="w-7 h-7 text-primary" /></div>
              Historial y Auditoría
            </h1>
            <p className="text-muted-foreground mt-1">Registro detallado con Filial + Sector</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={exportToCSV} variant="outline" className="gap-2"><Download className="w-4 h-4" />CSV/Excel</Button>
            <Button onClick={exportToPDF} variant="outline" className="gap-2"><FileText className="w-4 h-4" />PDF</Button>
          </div>
        </div>

        <div className="flex gap-2 p-1 bg-muted rounded-lg w-fit">
          <Button variant={activeTab === 'lecturas' ? 'default' : 'ghost'} size="sm" onClick={() => setActiveTab('lecturas')} className="gap-2"><FileText className="w-4 h-4" />Lecturas de Contadores</Button>
          <Button variant={activeTab === 'cambios' ? 'default' : 'ghost'} size="sm" onClick={() => setActiveTab('cambios')} className="gap-2"><HistoryIcon className="w-4 h-4" />Cambios en Impresoras</Button>
          <Button variant={activeTab === 'piezas' ? 'default' : 'ghost'} size="sm" onClick={() => setActiveTab('piezas')} className="gap-2"><Wrench className="w-4 h-4" />Reemplazo de Piezas</Button>
        </div>

        {/* Cascade Filters */}
        <Card>
          <CardHeader className="pb-4"><CardTitle className="text-lg flex items-center gap-2"><Filter className="w-5 h-5" />Filtros (Filial → Sector → Modelo → Impresora)</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-4">
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
                  <SelectContent className="bg-popover"><SelectItem value="all">Todos los modelos</SelectItem>{filteredModelos.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
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
              <div className="space-y-2">
                <Label className="text-sm">Buscar</Label>
                <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><Input placeholder="Impresora..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-9" /></div>
              </div>
            </div>
            <div className="flex justify-between items-center mt-4">
              <Button variant="outline" size="sm" className="gap-2" onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}><ArrowUpDown className="w-4 h-4" />{sortOrder === 'desc' ? 'Más reciente primero' : 'Más antiguo primero'}</Button>
              {hasActiveFilters && <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-2 text-destructive hover:text-destructive"><XCircle className="w-4 h-4" />Borrar filtros</Button>}
            </div>
          </CardContent>
        </Card>

        {/* Content */}
        <Card>
          <CardHeader>
            <CardTitle>{activeTab === 'lecturas' ? 'Historial de Lecturas' : activeTab === 'cambios' ? 'Historial de Cambios' : 'Historial de Reemplazo de Piezas'}</CardTitle>
            <CardDescription>{activeTab === 'lecturas' ? `${filteredLecturas.length} lecturas` : activeTab === 'cambios' ? `${filteredHistorial.length} cambios` : `${filteredPiezas.length} reemplazos`}</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
            ) : activeTab === 'lecturas' ? (
              filteredLecturas.length === 0 ? <div className="text-center py-12 text-muted-foreground"><FileText className="w-16 h-16 mx-auto mb-4 opacity-30" /><p>No hay lecturas</p></div> : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader><TableRow><TableHead>Fecha/Hora</TableHead><TableHead>Filial</TableHead><TableHead>Sector</TableHead><TableHead>Impresora</TableHead><TableHead>Modelo</TableHead><TableHead>Serie</TableHead><TableHead className="text-right">Negro</TableHead><TableHead className="text-right">Color</TableHead><TableHead>Registrado Por</TableHead><TableHead>Notas</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {filteredLecturas.map(l => { const pi = getPrinterInfo(l.impresora_id); return (
                        <TableRow key={l.id} className="hover:bg-muted/50">
                          <TableCell className="whitespace-nowrap"><div className="flex items-center gap-2"><Calendar className="w-4 h-4 text-muted-foreground" /><div><div className="font-medium">{new Date(l.fecha_lectura).toLocaleDateString('es')}</div><div className="text-xs text-muted-foreground">{new Date(l.fecha_lectura).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}</div></div></div></TableCell>
                          <TableCell className="text-muted-foreground">{getFilialName(pi?.filial_id || null)}</TableCell>
                          <TableCell className="text-muted-foreground">{getSectorName(pi?.sector_id || null)}</TableCell>
                          <TableCell><div className="flex items-center gap-2"><Printer className="w-4 h-4 text-primary" /><span className="font-medium">{l.impresoras?.nombre}</span></div></TableCell>
                          <TableCell>{pi?.modelo || '-'}</TableCell>
                          <TableCell className="font-mono text-sm text-muted-foreground">{l.impresoras?.serie}</TableCell>
                          <TableCell className="text-right font-medium">{l.contador_negro?.toLocaleString() ?? '-'}</TableCell>
                          <TableCell className="text-right font-medium">{l.contador_color?.toLocaleString() ?? '-'}</TableCell>
                          <TableCell><div className="flex items-center gap-1"><User className="w-3 h-3 text-muted-foreground" /><span className="text-sm">{getProfileName(l.registrado_por)}</span></div></TableCell>
                          <TableCell className="max-w-[200px] truncate text-muted-foreground">{l.notas || '-'}</TableCell>
                        </TableRow>
                      ); })}
                    </TableBody>
                  </Table>
                </div>
              )
            ) : activeTab === 'cambios' ? (
              filteredHistorial.length === 0 ? <div className="text-center py-12 text-muted-foreground"><HistoryIcon className="w-16 h-16 mx-auto mb-4 opacity-30" /><p>No hay cambios</p></div> : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader><TableRow><TableHead>Fecha/Hora</TableHead><TableHead>Filial</TableHead><TableHead>Impresora</TableHead><TableHead>Campo</TableHead><TableHead>Cambio</TableHead><TableHead>Realizado Por</TableHead><TableHead>Motivo</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {filteredHistorial.map(item => { const pi = getPrinterInfo(item.impresora_id); return (
                        <TableRow key={item.id} className="hover:bg-muted/50">
                          <TableCell className="whitespace-nowrap"><div><div className="font-medium">{new Date(item.created_at).toLocaleDateString('es')}</div><div className="text-xs text-muted-foreground">{new Date(item.created_at).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}</div></div></TableCell>
                          <TableCell className="text-muted-foreground">{getFilialName(pi?.filial_id || null)}</TableCell>
                          <TableCell><div className="flex items-center gap-2"><Printer className="w-4 h-4 text-primary" /><span className="font-medium">{item.impresoras?.nombre}</span></div></TableCell>
                          <TableCell><Badge variant="outline" className="capitalize">{item.campo_modificado}</Badge></TableCell>
                          <TableCell><div className="flex items-center gap-2 text-sm"><span className="text-muted-foreground line-through">{item.valor_anterior || 'N/A'}</span><ArrowRight className="w-4 h-4 text-muted-foreground" /><span className="font-medium text-success">{item.valor_nuevo || 'N/A'}</span></div></TableCell>
                          <TableCell><div className="flex items-center gap-1"><User className="w-3 h-3 text-muted-foreground" /><span className="text-sm">{getProfileName(item.usuario_id)}</span></div></TableCell>
                          <TableCell className="max-w-[200px] truncate text-muted-foreground">{item.motivo || '-'}</TableCell>
                        </TableRow>
                      ); })}
                    </TableBody>
                  </Table>
                </div>
              )
            ) : (
              filteredPiezas.length === 0 ? <div className="text-center py-12 text-muted-foreground"><Wrench className="w-16 h-16 mx-auto mb-4 opacity-30" /><p>No hay reemplazos</p></div> : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader><TableRow><TableHead>Fecha</TableHead><TableHead>Filial</TableHead><TableHead>Sector</TableHead><TableHead>Impresora</TableHead><TableHead>Pieza</TableHead><TableHead className="text-right">Contador</TableHead><TableHead>Técnico</TableHead><TableHead>Observación</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {filteredPiezas.map(pieza => { const pi = getPrinterInfo(pieza.impresora_id); return (
                        <TableRow key={pieza.id} className="hover:bg-muted/50">
                          <TableCell className="whitespace-nowrap"><div><div className="font-medium">{new Date(pieza.fecha_cambio).toLocaleDateString('es')}</div><div className="text-xs text-muted-foreground">{new Date(pieza.fecha_cambio).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}</div></div></TableCell>
                          <TableCell className="text-muted-foreground">{getFilialName(pi?.filial_id || null)}</TableCell>
                          <TableCell className="text-muted-foreground">{getSectorName(pi?.sector_id || null)}</TableCell>
                          <TableCell><div className="flex items-center gap-2"><Printer className="w-4 h-4 text-primary" /><span className="font-medium">{pieza.impresoras?.nombre}</span></div></TableCell>
                          <TableCell className="font-medium">{pieza.nombre_pieza}</TableCell>
                          <TableCell className="text-right font-mono">{pieza.contador_cambio.toLocaleString()}</TableCell>
                          <TableCell><div className="flex items-center gap-1"><User className="w-3 h-3 text-muted-foreground" /><span className="text-sm">{getProfileName(pieza.tecnico_id)}</span></div></TableCell>
                          <TableCell className="max-w-[200px] truncate text-muted-foreground">{pieza.observaciones || pieza.motivo || '-'}</TableCell>
                        </TableRow>
                      ); })}
                    </TableBody>
                  </Table>
                </div>
              )
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
