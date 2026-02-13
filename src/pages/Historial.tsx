import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { 
  History as HistoryIcon,
  Search,
  Filter,
  Download,
  Calendar,
  Printer,
  User,
  ArrowRight,
  Loader2,
  FileText,
  Wrench
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { addPDFHeader, addPDFPageNumbers } from '@/lib/pdfHeader';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface HistorialItem {
  id: string;
  created_at: string;
  campo_modificado: string;
  valor_anterior: string | null;
  valor_nuevo: string | null;
  motivo: string | null;
  impresora_id: string;
  usuario_id: string;
  impresoras?: {
    nombre: string;
    serie: string;
  };
  profiles?: {
    full_name: string | null;
    email: string;
  };
}

interface LecturaHistorial {
  id: string;
  fecha_lectura: string;
  contador_negro: number | null;
  contador_color: number | null;
  notas: string | null;
  impresora_id: string;
  impresoras?: {
    nombre: string;
    serie: string;
  };
}

interface PiezaHistorial {
  id: string;
  fecha_cambio: string;
  nombre_pieza: string;
  tipo_pieza: string;
  vida_util_estimada: number;
  vida_util_real: number | null;
  porcentaje_vida_consumida: number | null;
  contador_cambio: number;
  motivo: string | null;
  observaciones: string | null;
  impresora_id: string;
  impresoras?: {
    nombre: string;
    serie: string;
  };
}

export default function Historial() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [historial, setHistorial] = useState<HistorialItem[]>([]);
  const [piezas, setPiezas] = useState<PiezaHistorial[]>([]);
  const [lecturas, setLecturas] = useState<LecturaHistorial[]>([]);
  const [impresoras, setImpresoras] = useState<{ id: string; nombre: string; serie: string }[]>([]);
  
  // Filters
  const [filterPrinter, setFilterPrinter] = useState<string>('all');
  const [filterDateFrom, setFilterDateFrom] = useState<string>('');
  const [filterDateTo, setFilterDateTo] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'lecturas' | 'cambios' | 'piezas'>('lecturas');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    
    const [histResp, lecResp, piezasResp, impResp] = await Promise.all([
      supabase
        .from('historial_cambios')
        .select('*, impresoras(nombre, serie)')
        .order('created_at', { ascending: false })
        .limit(200),
      supabase
        .from('lecturas_contadores')
        .select('*, impresoras(nombre, serie)')
        .order('fecha_lectura', { ascending: false })
        .limit(200),
      supabase
        .from('historial_piezas')
        .select('*, impresoras(nombre, serie)')
        .order('fecha_cambio', { ascending: false })
        .limit(200),
      supabase.from('impresoras').select('id, nombre, serie').order('nombre'),
    ]);

    if (histResp.data) setHistorial(histResp.data as HistorialItem[]);
    if (lecResp.data) setLecturas(lecResp.data as LecturaHistorial[]);
    if (piezasResp.data) setPiezas(piezasResp.data as PiezaHistorial[]);
    if (impResp.data) setImpresoras(impResp.data);
    
    setLoading(false);
  };

  const filteredLecturas = lecturas.filter(l => {
    if (filterPrinter !== 'all' && l.impresora_id !== filterPrinter) return false;
    if (filterDateFrom && new Date(l.fecha_lectura) < new Date(filterDateFrom)) return false;
    if (filterDateTo && new Date(l.fecha_lectura) > new Date(filterDateTo + 'T23:59:59')) return false;
    if (searchTerm && !l.impresoras?.nombre.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  const filteredHistorial = historial.filter(h => {
    if (filterPrinter !== 'all' && h.impresora_id !== filterPrinter) return false;
    if (filterDateFrom && new Date(h.created_at) < new Date(filterDateFrom)) return false;
    if (filterDateTo && new Date(h.created_at) > new Date(filterDateTo + 'T23:59:59')) return false;
    if (searchTerm && !h.impresoras?.nombre.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  const filteredPiezas = piezas.filter(p => {
    if (filterPrinter !== 'all' && p.impresora_id !== filterPrinter) return false;
    if (filterDateFrom && new Date(p.fecha_cambio) < new Date(filterDateFrom)) return false;
    if (filterDateTo && new Date(p.fecha_cambio) > new Date(filterDateTo + 'T23:59:59')) return false;
    if (searchTerm && !p.impresoras?.nombre.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  const exportToCSV = () => {
    let data: Record<string, any>[] = [];
    if (activeTab === 'lecturas') {
      data = filteredLecturas.map(l => ({
        Fecha: new Date(l.fecha_lectura).toLocaleString('es'),
        Impresora: l.impresoras?.nombre || '',
        Serie: l.impresoras?.serie || '',
        ContadorNegro: l.contador_negro || '',
        ContadorColor: l.contador_color || '',
        Notas: l.notas || '',
      }));
    } else if (activeTab === 'cambios') {
      data = filteredHistorial.map(h => ({
        Fecha: new Date(h.created_at).toLocaleString('es'),
        Impresora: h.impresoras?.nombre || '',
        Campo: h.campo_modificado,
        ValorAnterior: h.valor_anterior || '',
        ValorNuevo: h.valor_nuevo || '',
        Motivo: h.motivo || '',
      }));
    } else {
      data = filteredPiezas.map(p => ({
        Fecha: new Date(p.fecha_cambio).toLocaleString('es'),
        Impresora: p.impresoras?.nombre || '',
        Pieza: p.nombre_pieza,
        Tipo: p.tipo_pieza,
        VidaUtilEstimada: p.vida_util_estimada,
        VidaUtilReal: p.vida_util_real || '',
        PorcentajeConsumo: p.porcentaje_vida_consumida ? `${p.porcentaje_vida_consumida}%` : '',
        Motivo: p.motivo || '',
      }));
    }

    const headers = Object.keys(data[0] || {}).join(',');
    const rows = data.map(row => Object.values(row).map(v => `"${v}"`).join(',')).join('\n');
    const csv = `${headers}\n${rows}`;
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `historial_${activeTab}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    
    toast({ title: 'Exportado', description: 'El archivo CSV ha sido descargado.' });
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    const tabLabels: Record<string, string> = { lecturas: 'Lecturas de Contadores', cambios: 'Cambios de Configuración', piezas: 'Reemplazo de Piezas' };
    const startY = addPDFHeader(doc, 'Historial y Auditoría', tabLabels[activeTab]);

    let head: string[][] = [];
    let body: string[][] = [];

    if (activeTab === 'lecturas') {
      head = [['Fecha', 'Impresora', 'Serie', 'Negro', 'Color', 'Notas']];
      body = filteredLecturas.map(l => [
        new Date(l.fecha_lectura).toLocaleString('es'),
        l.impresoras?.nombre || '-', l.impresoras?.serie || '-',
        l.contador_negro?.toLocaleString() ?? '-', l.contador_color?.toLocaleString() ?? '-',
        l.notas || '-',
      ]);
    } else if (activeTab === 'cambios') {
      head = [['Fecha', 'Impresora', 'Campo', 'Anterior', 'Nuevo', 'Motivo']];
      body = filteredHistorial.map(h => [
        new Date(h.created_at).toLocaleString('es'),
        h.impresoras?.nombre || '-', h.campo_modificado,
        h.valor_anterior || '-', h.valor_nuevo || '-', h.motivo || '-',
      ]);
    } else {
      head = [['Fecha', 'Impresora', 'Pieza', 'Tipo', 'Vida Estimada', 'Vida Real', '% Consumo', 'Motivo']];
      body = filteredPiezas.map(p => [
        new Date(p.fecha_cambio).toLocaleString('es'),
        p.impresoras?.nombre || '-', p.nombre_pieza, p.tipo_pieza,
        p.vida_util_estimada.toLocaleString(), (p.vida_util_real || 0).toLocaleString(),
        p.porcentaje_vida_consumida ? `${p.porcentaje_vida_consumida}%` : '-', p.motivo || '-',
      ]);
    }

    autoTable(doc, {
      startY, head, body,
      theme: 'striped',
      headStyles: { fillColor: [59, 130, 246], textColor: 255 },
      styles: { fontSize: 7 },
    });

    addPDFPageNumbers(doc);
    doc.save(`historial_${activeTab}_${new Date().toISOString().split('T')[0]}.pdf`);
    toast({ title: 'PDF Generado', description: 'El historial ha sido descargado.' });
  };

  const clearFilters = () => {
    setFilterPrinter('all');
    setFilterDateFrom('');
    setFilterDateTo('');
    setSearchTerm('');
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <HistoryIcon className="w-7 h-7 text-primary" />
              </div>
              Historial y Auditoría
            </h1>
            <p className="text-muted-foreground mt-1">
              Registro detallado de lecturas y cambios en el sistema
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={exportToCSV} variant="outline" className="gap-2">
              <Download className="w-4 h-4" />
              CSV
            </Button>
            <Button onClick={exportToPDF} variant="outline" className="gap-2">
              <FileText className="w-4 h-4" />
              PDF
            </Button>
          </div>
        </div>

        {/* Tab selector */}
        <div className="flex gap-2 p-1 bg-muted rounded-lg w-fit">
          <Button
            variant={activeTab === 'lecturas' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab('lecturas')}
            className="gap-2"
          >
            <FileText className="w-4 h-4" />
            Lecturas de Contadores
          </Button>
          <Button
            variant={activeTab === 'cambios' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab('cambios')}
            className="gap-2"
          >
            <HistoryIcon className="w-4 h-4" />
            Cambios en Impresoras
          </Button>
          <Button
            variant={activeTab === 'piezas' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab('piezas')}
            className="gap-2"
          >
            <Wrench className="w-4 h-4" />
            Reemplazo de Piezas
          </Button>
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
                <Label className="text-sm">Buscar</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Nombre de impresora..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label className="text-sm">Impresora</Label>
                <Select value={filterPrinter} onValueChange={setFilterPrinter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover">
                    <SelectItem value="all">Todas las impresoras</SelectItem>
                    {impresoras.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>
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
            
            <div className="flex justify-end mt-4">
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                Limpiar filtros
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Content */}
        <Card>
          <CardHeader>
            <CardTitle>
              {activeTab === 'lecturas' ? 'Historial de Lecturas' : activeTab === 'cambios' ? 'Historial de Cambios' : 'Historial de Reemplazo de Piezas'}
            </CardTitle>
            <CardDescription>
              {activeTab === 'lecturas' 
                ? `${filteredLecturas.length} lecturas encontradas`
                : activeTab === 'cambios'
                ? `${filteredHistorial.length} cambios encontrados`
                : `${filteredPiezas.length} reemplazos encontrados`
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : activeTab === 'lecturas' ? (
              filteredLecturas.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <FileText className="w-16 h-16 mx-auto mb-4 opacity-30" />
                  <p>No hay lecturas que coincidan con los filtros</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Fecha/Hora</TableHead>
                        <TableHead>Impresora</TableHead>
                        <TableHead>Serie</TableHead>
                        <TableHead className="text-right">Contador Negro</TableHead>
                        <TableHead className="text-right">Contador Color</TableHead>
                        <TableHead>Notas</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredLecturas.map((lectura) => (
                        <TableRow key={lectura.id} className="hover:bg-muted/50">
                          <TableCell className="whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <Calendar className="w-4 h-4 text-muted-foreground" />
                              <div>
                                <div className="font-medium">
                                  {new Date(lectura.fecha_lectura).toLocaleDateString('es')}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {new Date(lectura.fecha_lectura).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}
                                </div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Printer className="w-4 h-4 text-primary" />
                              <span className="font-medium">{lectura.impresoras?.nombre}</span>
                            </div>
                          </TableCell>
                          <TableCell className="font-mono text-sm text-muted-foreground">
                            {lectura.impresoras?.serie}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {lectura.contador_negro?.toLocaleString() ?? '-'}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {lectura.contador_color?.toLocaleString() ?? '-'}
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate text-muted-foreground">
                            {lectura.notas || '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )
            ) : activeTab === 'cambios' ? (
              filteredHistorial.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <HistoryIcon className="w-16 h-16 mx-auto mb-4 opacity-30" />
                  <p>No hay cambios que coincidan con los filtros</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Fecha/Hora</TableHead>
                        <TableHead>Impresora</TableHead>
                        <TableHead>Campo Modificado</TableHead>
                        <TableHead>Cambio</TableHead>
                        <TableHead>Motivo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredHistorial.map((item) => (
                        <TableRow key={item.id} className="hover:bg-muted/50">
                          <TableCell className="whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <Calendar className="w-4 h-4 text-muted-foreground" />
                              <div>
                                <div className="font-medium">
                                  {new Date(item.created_at).toLocaleDateString('es')}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {new Date(item.created_at).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}
                                </div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Printer className="w-4 h-4 text-primary" />
                              <span className="font-medium">{item.impresoras?.nombre}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="capitalize">
                              {item.campo_modificado}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2 text-sm">
                              <span className="text-muted-foreground line-through">
                                {item.valor_anterior || 'N/A'}
                              </span>
                              <ArrowRight className="w-4 h-4 text-muted-foreground" />
                              <span className="font-medium text-success">
                                {item.valor_nuevo || 'N/A'}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate text-muted-foreground">
                            {item.motivo || '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )
            ) : (
              filteredPiezas.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Wrench className="w-16 h-16 mx-auto mb-4 opacity-30" />
                  <p>No hay reemplazos que coincidan con los filtros</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Impresora</TableHead>
                        <TableHead>Pieza</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead className="text-right">Vida Útil Est.</TableHead>
                        <TableHead className="text-right">Vida Real</TableHead>
                        <TableHead className="text-right">% Consumido</TableHead>
                        <TableHead>Motivo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredPiezas.map((pieza) => (
                        <TableRow key={pieza.id} className="hover:bg-muted/50">
                          <TableCell className="whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <Calendar className="w-4 h-4 text-muted-foreground" />
                              <div>
                                <div className="font-medium">
                                  {new Date(pieza.fecha_cambio).toLocaleDateString('es')}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {new Date(pieza.fecha_cambio).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}
                                </div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Printer className="w-4 h-4 text-primary" />
                              <span className="font-medium">{pieza.impresoras?.nombre}</span>
                            </div>
                          </TableCell>
                          <TableCell className="font-medium">{pieza.nombre_pieza}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="capitalize">
                              {pieza.tipo_pieza.replace('_', ' ')}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {pieza.vida_util_estimada.toLocaleString()} págs
                          </TableCell>
                          <TableCell className="text-right">
                            {pieza.vida_util_real ? `${pieza.vida_util_real.toLocaleString()} págs` : '-'}
                          </TableCell>
                          <TableCell className="text-right">
                            {pieza.porcentaje_vida_consumida !== null ? (
                              <span className={cn(
                                'font-medium',
                                pieza.porcentaje_vida_consumida >= 90 ? 'text-destructive' :
                                pieza.porcentaje_vida_consumida >= 70 ? 'text-warning' : 'text-success'
                              )}>
                                {pieza.porcentaje_vida_consumida}%
                              </span>
                            ) : '-'}
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate text-muted-foreground">
                            {pieza.motivo || pieza.observaciones || '-'}
                          </TableCell>
                        </TableRow>
                      ))}
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
