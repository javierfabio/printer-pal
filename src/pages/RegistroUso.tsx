import { useEffect, useState, useMemo } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Plus, 
  Loader2, 
  Printer, 
  AlertTriangle, 
  TrendingUp, 
  FileText,
  ArrowRight,
  Calculator,
  Clock,
  CheckCircle2,
  Package,
  Droplets,
  Download,
  QrCode,
  X,
  Search,
} from 'lucide-react';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { useRef } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { addPDFHeader, addPDFPageNumbers } from '@/lib/pdfHeader';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useSearchParams } from 'react-router-dom';
import { InactivityPanel } from '@/components/registro/InactivityPanel';
import { FetchErrorState } from '@/components/ui/fetch-error-state';

interface Impresora {
  id: string;
  serie: string;
  nombre: string;
  modelo: string;
  fecha_registro: string;
  tipo_consumo: string;
  tipo_impresion: string;
  contador_negro_actual: number;
  contador_color_actual: number;
  contador_negro_inicial: number;
  contador_color_inicial: number;
  sector_id: string | null;
  filial_id: string | null;
  sectores?: { nombre: string } | null;
  filiales?: { nombre: string } | null;
}

interface LecturaContador {
  id: string;
  impresora_id: string;
  contador_negro: number | null;
  contador_color: number | null;
  fecha_lectura: string;
  notas: string | null;
  registrado_por: string;
  impresoras?: {
    nombre: string;
    serie: string;
    modelo: string;
    tipo_impresion: string;
    sector_id: string | null;
    filial_id: string | null;
  };
}

interface PiezaImpresora {
  id: string;
  tipo_pieza: string;
  nombre_pieza: string;
  vida_util_estimada: number;
  contador_instalacion: number;
  paginas_consumidas: number;
}

interface Sector { id: string; nombre: string; }
interface Filial { id: string; nombre: string; }

const TIPO_PIEZA_LABELS: Record<string, string> = {
  toner_negro: 'Tóner Negro',
  toner_color: 'Tóner Color',
  fusor: 'Fusor',
  unidad_imagen: 'Unidad de Imagen',
  malla: 'Malla',
  transfer_belt: 'Transfer Belt',
  rodillo: 'Rodillo',
  otro: 'Otra Pieza',
};

const HIGH_CONSUMPTION_THRESHOLD = 5000;

export default function RegistroUso() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [impresoras, setImpresoras] = useState<Impresora[]>([]);
  const [lecturas, setLecturas] = useState<LecturaContador[]>([]);
  const [piezasPrinter, setPiezasPrinter] = useState<PiezaImpresora[]>([]);
  const [sectores, setSectores] = useState<Sector[]>([]);
  const [filiales, setFiliales] = useState<Filial[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const [selectedPrinter, setSelectedPrinter] = useState<string>('');
  const [contadorNegro, setContadorNegro] = useState<string>('');
  const [contadorColor, setContadorColor] = useState<string>('');
  const [notas, setNotas] = useState('');
  const [printerSearch, setPrinterSearch] = useState('');

  // Cascade filters
  const [filterFilial, setFilterFilial] = useState<string>('all');
  const [filterSector, setFilterSector] = useState<string>('all');
  const [filterModelo, setFilterModelo] = useState<string>('all');
  const activeTab = searchParams.get('tab') === 'sin-actividad' ? 'sin-actividad' : 'lecturas';

  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannerError, setScannerError] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);

  const [filterSectorSearch, setFilterSectorSearch] = useState('');
  const [filterFilialSearch, setFilterFilialSearch] = useState('');

  const handleQRScan = (decodedText: string) => {
    try {
      // QR puede contener una URL /scan/:id o un JSON {id, serie}
      let foundId: string | null = null;
      let foundSerie: string | null = null;
      const m = decodedText.match(/\/scan\/([0-9a-fA-F-]{8,})/);
      if (m) foundId = m[1];
      else {
        try {
          const data = JSON.parse(decodedText);
          foundId = data.id || null;
          foundSerie = data.serie || null;
        } catch { /* not json */ }
      }
      const found = impresoras.find(p => (foundId && p.id === foundId) || (foundSerie && p.serie === foundSerie));
      if (found) {
        setSelectedPrinter(found.id);
        setScannerOpen(false);
        setScannerError('');
        toast({ title: '✅ Impresora encontrada', description: `${found.nombre} — ${found.serie}` });
      } else {
        setScannerError('QR no reconocido en el sistema. Verificá que la impresora esté registrada.');
      }
    } catch {
      setScannerError('Código QR inválido. Usá un QR generado por PrintControl.');
    }
  };

  useEffect(() => {
    if (!scannerOpen) {
      readerRef.current = null;
      return;
    }
    const reader = new BrowserMultiFormatReader();
    readerRef.current = reader;
    reader.decodeFromVideoDevice(undefined, videoRef.current!, (result) => {
      if (result) {
        handleQRScan(result.getText());
      }
    }).catch(() => setScannerError('No se pudo acceder a la cámara'));
    return () => { readerRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scannerOpen]);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    const printerId = searchParams.get('impresora');
    if (!printerId || impresoras.length === 0) return;

    const exists = impresoras.some((printer) => printer.id === printerId);
    if (!exists) return;

    setDialogOpen(true);
    setSelectedPrinter(printerId);
  }, [impresoras, searchParams]);

  const fetchData = async () => {
    setLoading(true);
    setFetchError(null);
    try {
    const [impResp, lecResp, secResp, filResp] = await Promise.all([
      supabase.from('impresoras').select('*, sectores(nombre), filiales(nombre)').eq('estado', 'activa').order('nombre'),
      supabase
        .from('lecturas_contadores')
        .select('*, impresoras(nombre, serie, modelo, tipo_impresion, sector_id, filial_id)')
        .order('fecha_lectura', { ascending: false }),
      supabase.from('sectores').select('id, nombre').eq('activo', true),
      supabase.from('filiales').select('id, nombre').eq('activo', true),
    ]);

    if (impResp.data) setImpresoras(impResp.data as any[]);
    if (lecResp.data) setLecturas(lecResp.data as LecturaContador[]);
    if (secResp.data) setSectores(secResp.data);
    if (filResp.data) setFiliales(filResp.data);
    } catch (error) {
      console.error('Error al cargar datos:', error);
      setFetchError('No se pudieron cargar los datos. Verificá tu conexión.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const fetchPiezas = async () => {
      if (!selectedPrinter) { setPiezasPrinter([]); return; }
      const { data } = await supabase
        .from('piezas_impresora')
        .select('*')
        .eq('impresora_id', selectedPrinter)
        .eq('activo', true);
      if (data) setPiezasPrinter(data as PiezaImpresora[]);
    };
    fetchPiezas();
  }, [selectedPrinter]);

  // Cascade filter logic
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

  const filteredPrinters = useMemo(() => {
    let result = impresoras;
    if (filterFilial !== 'all') result = result.filter(p => p.filial_id === filterFilial);
    if (filterSector !== 'all') result = result.filter(p => p.sector_id === filterSector);
    if (filterModelo !== 'all') result = result.filter(p => p.modelo === filterModelo);
    if (printerSearch.trim()) {
      const q = printerSearch.toLowerCase();
      result = result.filter(p =>
        p.nombre.toLowerCase().includes(q) ||
        p.serie.toLowerCase().includes(q) ||
        p.modelo.toLowerCase().includes(q) ||
        (p.sectores?.nombre || '').toLowerCase().includes(q) ||
        (p.filiales?.nombre || '').toLowerCase().includes(q)
      );
    }
    return result;
  }, [impresoras, printerSearch, filterFilial, filterSector, filterModelo]);

  const getFilialName = (filialId: string | null) => filiales.find(f => f.id === filialId)?.nombre || '-';
  const getSectorName = (sectorId: string | null) => sectores.find(s => s.id === sectorId)?.nombre || '-';

  // Filtered lecturas for the table
  const filteredLecturas = useMemo(() => {
    let result = lecturas;
    if (filterFilial !== 'all') result = result.filter(l => l.impresoras?.filial_id === filterFilial);
    if (filterSector !== 'all') result = result.filter(l => l.impresoras?.sector_id === filterSector);
    if (filterModelo !== 'all') result = result.filter(l => l.impresoras?.modelo === filterModelo);
    return result;
  }, [lecturas, filterFilial, filterSector, filterModelo]);

  const selectedPrinterData = impresoras.find(p => p.id === selectedPrinter);

  const lecturasConPeriodo = useMemo(() => {
    const grouped = new Map<string, LecturaContador[]>();

    filteredLecturas.forEach((lectura) => {
      const list = grouped.get(lectura.impresora_id) || [];
      list.push(lectura);
      grouped.set(lectura.impresora_id, list);
    });

    const rows: Array<LecturaContador & { periodoNegro: number | null; periodoColor: number | null; periodoTotal: number | null; isHigh: boolean }> = [];

    grouped.forEach((printerReadings) => {
      const asc = [...printerReadings].sort((a, b) => new Date(a.fecha_lectura).getTime() - new Date(b.fecha_lectura).getTime());
      const totals: number[] = [];
      asc.forEach((lectura, index) => {
        if (index === 0) {
          rows.push({ ...lectura, periodoNegro: null, periodoColor: null, periodoTotal: null, isHigh: false });
          return;
        }

        const previous = asc[index - 1];
        const periodoNegro = Math.max(0, (lectura.contador_negro || 0) - (previous.contador_negro || 0));
        const periodoColor = Math.max(0, (lectura.contador_color || 0) - (previous.contador_color || 0));
        const periodoTotal = periodoNegro + periodoColor;
        const historicalAverage = totals.length > 0 ? totals.reduce((acc, value) => acc + value, 0) / totals.length : null;
        const isHigh = historicalAverage !== null && periodoTotal > historicalAverage * 2;
        totals.push(periodoTotal);

        rows.push({
          ...lectura,
          periodoNegro,
          periodoColor,
          periodoTotal,
          isHigh,
        });
      });
    });

    return rows.sort((a, b) => new Date(b.fecha_lectura).getTime() - new Date(a.fecha_lectura).getTime());
  }, [filteredLecturas]);

  const paginasNegro = useMemo(() => {
    if (!selectedPrinterData || !contadorNegro) return 0;
    return Math.max(0, (parseInt(contadorNegro) || 0) - selectedPrinterData.contador_negro_actual);
  }, [selectedPrinterData, contadorNegro]);

  const paginasColor = useMemo(() => {
    if (!selectedPrinterData || !contadorColor) return 0;
    return Math.max(0, (parseInt(contadorColor) || 0) - selectedPrinterData.contador_color_actual);
  }, [selectedPrinterData, contadorColor]);

  const totalPaginas = paginasNegro + paginasColor;

  const showBothCounters = selectedPrinterData?.tipo_consumo === 'toner' && selectedPrinterData?.tipo_impresion === 'color';
  const showOnlyColor = selectedPrinterData?.tipo_impresion === 'color' && selectedPrinterData?.tipo_consumo === 'tinta';
  const showOnlyBlack = selectedPrinterData?.tipo_impresion === 'monocromatico';

  const isHighConsumption = paginasNegro > HIGH_CONSUMPTION_THRESHOLD || paginasColor > HIGH_CONSUMPTION_THRESHOLD;

  const piezasImpacto = useMemo(() => {
    if (!piezasPrinter.length || !totalPaginas) return [];
    const contadorActual = selectedPrinterData 
      ? selectedPrinterData.contador_negro_actual + selectedPrinterData.contador_color_actual 
      : 0;
    return piezasPrinter.map(pieza => {
      const paginasUsadasActual = contadorActual - pieza.contador_instalacion + pieza.paginas_consumidas;
      const porcentajeActual = (paginasUsadasActual / pieza.vida_util_estimada) * 100;
      const paginasUsadasNuevo = paginasUsadasActual + totalPaginas;
      const porcentajeNuevo = (paginasUsadasNuevo / pieza.vida_util_estimada) * 100;
      const paginasRestantes = Math.max(0, pieza.vida_util_estimada - paginasUsadasNuevo);
      let status: 'ok' | 'warning' | 'critical' = 'ok';
      if (porcentajeNuevo >= 90) status = 'critical';
      else if (porcentajeNuevo >= 70) status = 'warning';
      return { ...pieza, porcentajeActual, porcentajeNuevo, paginasRestantes, status };
    });
  }, [piezasPrinter, totalPaginas, selectedPrinterData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPrinter || !user) return;
    const printer = impresoras.find(p => p.id === selectedPrinter);
    if (!printer) return;

    const negroValue = parseInt(contadorNegro) || 0;
    const colorValue = parseInt(contadorColor) || 0;

    if (showOnlyBlack || showBothCounters) {
      if (negroValue < printer.contador_negro_actual) {
        toast({ variant: 'destructive', title: 'Error de validación', description: 'El contador negro no puede ser menor al valor actual.' });
        return;
      }
    }
    if (showOnlyColor || showBothCounters) {
      if (colorValue < printer.contador_color_actual) {
        toast({ variant: 'destructive', title: 'Error de validación', description: 'El contador color no puede ser menor al valor actual.' });
        return;
      }
    }

    setSaving(true);
    const { error: lecturaError } = await supabase.from('lecturas_contadores').insert({
      impresora_id: selectedPrinter,
      contador_negro: (showOnlyBlack || showBothCounters) ? negroValue : null,
      contador_color: (showOnlyColor || showBothCounters) ? colorValue : null,
      registrado_por: user.id,
      notas: notas || null,
    });

    if (lecturaError) {
      toast({ variant: 'destructive', title: 'Error', description: lecturaError.message });
      setSaving(false);
      return;
    }

    const updates: Record<string, number> = {};
    if (showOnlyBlack || showBothCounters) updates.contador_negro_actual = negroValue;
    if (showOnlyColor || showBothCounters) updates.contador_color_actual = colorValue;

    const { error: updateError } = await supabase.from('impresoras').update(updates).eq('id', selectedPrinter);

    if (updateError) {
      toast({ variant: 'destructive', title: 'Error', description: updateError.message });
    } else {
      if (piezasPrinter.length > 0 && totalPaginas > 0) {
        for (const pieza of piezasPrinter) {
          await supabase.from('piezas_impresora').update({ paginas_consumidas: pieza.paginas_consumidas + totalPaginas }).eq('id', pieza.id);
        }
      }
      toast({ title: 'Lectura registrada', description: `Se registraron ${totalPaginas.toLocaleString()} páginas impresas.` });
      setDialogOpen(false);
      resetForm();
      fetchData();
    }
    setSaving(false);
  };

  const resetForm = () => {
    setSelectedPrinter('');
    setContadorNegro('');
    setContadorColor('');
    setNotas('');
    setPiezasPrinter([]);
    setPrinterSearch('');
  };

  const totalPaginasHoy = lecturas
    .filter(l => new Date(l.fecha_lectura).toDateString() === new Date().toDateString())
    .reduce((acc, l) => acc + (l.contador_negro || 0) + (l.contador_color || 0), 0);

  const lecturasHoy = lecturas.filter(l => 
    new Date(l.fecha_lectura).toDateString() === new Date().toDateString()
  ).length;

  const exportLecturasPDF = () => {
    const doc = new jsPDF('landscape');
    const startY = addPDFHeader(doc, 'Registro de Uso', 'Lecturas de Contadores');

    const tableData = lecturasConPeriodo.map(l => [
      new Date(l.fecha_lectura).toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' }),
      new Date(l.fecha_lectura).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' }),
      getFilialName(l.impresoras?.filial_id || null),
      getSectorName(l.impresoras?.sector_id || null),
      l.impresoras?.nombre || '-',
      l.impresoras?.modelo || '-',
      l.impresoras?.serie || '-',
      l.contador_negro?.toLocaleString() ?? '-',
      l.contador_color?.toLocaleString() ?? '-',
      l.periodoNegro === null ? 'Primera lectura' : l.periodoNegro.toLocaleString(),
      l.periodoColor === null ? 'Primera lectura' : l.periodoColor.toLocaleString(),
      l.periodoTotal === null ? 'Primera lectura' : l.periodoTotal.toLocaleString(),
      l.notas || '-',
    ]);

    autoTable(doc, {
      startY,
      head: [['Fecha', 'Hora', 'Filial', 'Sector', 'Impresora', 'Modelo', 'Serie', 'Negro', 'Color', 'B/N Período', 'Color Período', 'Total Período', 'Notas']],
      body: tableData,
      theme: 'striped',
      headStyles: { fillColor: [59, 130, 246], textColor: 255 },
      styles: { fontSize: 7 },
    });

    addPDFPageNumbers(doc);
    doc.save(`registro_uso_${new Date().toISOString().split('T')[0]}.pdf`);
    toast({ title: 'PDF Generado', description: 'El registro de uso ha sido descargado.' });
  };

  const exportLecturasCSV = () => {
    const data = lecturasConPeriodo.map(l => ({
      Fecha: new Date(l.fecha_lectura).toLocaleDateString('es'),
      Hora: new Date(l.fecha_lectura).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' }),
      Filial: getFilialName(l.impresoras?.filial_id || null),
      Sector: getSectorName(l.impresoras?.sector_id || null),
      Impresora: l.impresoras?.nombre || '',
      Modelo: l.impresoras?.modelo || '',
      Serie: l.impresoras?.serie || '',
      ContadorNegro: l.contador_negro ?? '',
      ContadorColor: l.contador_color ?? '',
      BNPeriodo: l.periodoNegro ?? 'Primera lectura',
      ColorPeriodo: l.periodoColor ?? 'Primera lectura',
      TotalPeriodo: l.periodoTotal ?? 'Primera lectura',
      Notas: l.notas || '',
    }));
    if (data.length === 0) return;
    const headers = Object.keys(data[0]).join(',');
    const rows = data.map(row => Object.values(row).map(v => `"${v}"`).join(',')).join('\n');
    const csv = `${headers}\n${rows}`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `registro_uso_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    toast({ title: 'Exportado', description: 'El archivo CSV ha sido descargado.' });
  };

  const hasActiveFilters = filterFilial !== 'all' || filterSector !== 'all' || filterModelo !== 'all';

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Calculator className="w-7 h-7 text-primary" />
              </div>
              Registro de Uso
            </h1>
            <p className="text-muted-foreground mt-1">
              Registra las lecturas de contadores de páginas impresas
            </p>
          </div>
          
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2" onClick={exportLecturasCSV}>
              <Download className="w-4 h-4" />
              CSV
            </Button>
            <Button variant="outline" className="gap-2" onClick={exportLecturasPDF}>
              <FileText className="w-4 h-4" />
              PDF
            </Button>
            <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="w-4 h-4" />
                  Nueva Lectura
                </Button>
              </DialogTrigger>
              <DialogContent
                className="max-w-2xl max-h-[90vh] overflow-y-auto"
                onInteractOutside={(e) => e.preventDefault()}
                onEscapeKeyDown={(e) => e.preventDefault()}
              >
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Printer className="w-5 h-5 text-primary" />
                    Registrar Lectura de Contador
                  </DialogTitle>
                </DialogHeader>
                
                <form onSubmit={handleSubmit} className="space-y-5 mt-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Seleccionar Impresora *</Label>
                    <div className="flex gap-2 items-center mb-2">
                      <Input
                        placeholder="Filtrar por serie, modelo, sector o filial..."
                        value={printerSearch}
                        onChange={e => setPrinterSearch(e.target.value)}
                        className="h-10 flex-1"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-10 w-10 flex-shrink-0"
                        title="Escanear código QR"
                        onClick={() => { setScannerOpen(v => !v); setScannerError(''); }}
                      >
                        <QrCode className="w-4 h-4" />
                      </Button>
                    </div>
                    {scannerOpen && (
                      <div className="rounded-lg overflow-hidden border border-border bg-black relative mb-2">
                        <div className="absolute top-2 left-2 z-10 bg-black/60 text-white text-xs px-2 py-1 rounded">
                          Apuntá la cámara al QR de la impresora
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute top-2 right-2 z-10 bg-black/50 text-white hover:bg-black/70"
                          onClick={() => setScannerOpen(false)}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                        <video ref={videoRef} className="w-full max-h-56 object-cover" />
                        {scannerError && (
                          <div className="px-3 py-2 bg-destructive/90 text-destructive-foreground text-xs text-center">
                            {scannerError}
                          </div>
                        )}
                      </div>
                    )}
                    <Select value={selectedPrinter} onValueChange={setSelectedPrinter}>
                      <SelectTrigger className="h-11">
                        <SelectValue placeholder="Seleccionar impresora..." />
                      </SelectTrigger>
                      <SelectContent className="bg-popover">
                        {filteredPrinters.length === 0 && (
                          <div className="px-3 py-2 text-sm text-muted-foreground">Sin resultados</div>
                        )}
                        {filteredPrinters.map(p => (
                          <SelectItem key={p.id} value={p.id}>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{p.nombre}</span>
                              <span className="text-muted-foreground text-xs">
                                ({p.serie} · {p.modelo}{p.filiales?.nombre ? ` · ${p.filiales.nombre}` : ''}{p.sectores?.nombre ? ` - ${p.sectores.nombre}` : ''})
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {selectedPrinterData && (
                    <>
                      <Card className="bg-muted/50 border-border/50">
                        <CardContent className="pt-4 space-y-3">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Modelo</span>
                            <span className="font-medium">{selectedPrinterData.modelo}</span>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Filial / Sector</span>
                            <span className="font-medium">
                              {selectedPrinterData.filiales?.nombre || '-'} / {selectedPrinterData.sectores?.nombre || '-'}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Tipo</span>
                            <Badge variant="outline">
                              {selectedPrinterData.tipo_impresion} / {selectedPrinterData.tipo_consumo}
                            </Badge>
                          </div>
                          <Separator />
                          <div className="text-sm font-medium text-muted-foreground mb-2">
                            Contadores Actuales:
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            {(showOnlyBlack || showBothCounters) && (
                              <div className="p-3 rounded-lg bg-background border">
                                <p className="text-xs text-muted-foreground">Contador Negro</p>
                                <p className="text-xl font-bold">{selectedPrinterData.contador_negro_actual.toLocaleString()}</p>
                              </div>
                            )}
                            {(showOnlyColor || showBothCounters) && (
                              <div className="p-3 rounded-lg bg-background border">
                                <p className="text-xs text-muted-foreground">Contador Color</p>
                                <p className="text-xl font-bold">{selectedPrinterData.contador_color_actual.toLocaleString()}</p>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>

                      <div className="space-y-4">
                        {(showOnlyBlack || showBothCounters) && (
                          <div className="space-y-2">
                            <Label className="text-sm font-medium">Nuevo Contador Negro *</Label>
                            <Input type="number" min={selectedPrinterData.contador_negro_actual} value={contadorNegro} onChange={e => setContadorNegro(e.target.value)} placeholder={`Mínimo: ${selectedPrinterData.contador_negro_actual}`} className="h-11" required />
                          </div>
                        )}
                        {(showOnlyColor || showBothCounters) && (
                          <div className="space-y-2">
                            <Label className="text-sm font-medium">Nuevo Contador Color *</Label>
                            <Input type="number" min={selectedPrinterData.contador_color_actual} value={contadorColor} onChange={e => setContadorColor(e.target.value)} placeholder={`Mínimo: ${selectedPrinterData.contador_color_actual}`} className="h-11" required />
                          </div>
                        )}
                      </div>

                      {(contadorNegro || contadorColor) && (
                        <Card className={cn("border-2", isHighConsumption ? "border-warning bg-warning/5" : "border-success bg-success/5")}>
                          <CardContent className="pt-4">
                            <div className="flex items-center gap-2 mb-3">
                              <TrendingUp className={cn("w-5 h-5", isHighConsumption ? "text-warning" : "text-success")} />
                              <span className="font-semibold">Cálculo de Páginas Impresas</span>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              {(showOnlyBlack || showBothCounters) && paginasNegro > 0 && (
                                <div className="flex items-center gap-2">
                                  <ArrowRight className="w-4 h-4 text-muted-foreground" />
                                  <span>Negro: <strong className="text-lg">{paginasNegro.toLocaleString()}</strong> págs</span>
                                </div>
                              )}
                              {(showOnlyColor || showBothCounters) && paginasColor > 0 && (
                                <div className="flex items-center gap-2">
                                  <ArrowRight className="w-4 h-4 text-muted-foreground" />
                                  <span>Color: <strong className="text-lg">{paginasColor.toLocaleString()}</strong> págs</span>
                                </div>
                              )}
                            </div>
                            {isHighConsumption && (
                              <div className="flex items-center gap-2 mt-3 text-warning text-sm">
                                <AlertTriangle className="w-4 h-4" />
                                <span>Consumo elevado detectado</span>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      )}

                      {piezasImpacto.length > 0 && totalPaginas > 0 && (
                        <Card className="border-info/50 bg-info/5">
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm flex items-center gap-2">
                              <Package className="w-4 h-4 text-info" />
                              Impacto en Piezas Instaladas
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            {piezasImpacto.map(pieza => (
                              <div key={pieza.id} className={cn(
                                "p-3 rounded-lg border",
                                pieza.status === 'critical' && "border-destructive/50 bg-destructive/5",
                                pieza.status === 'warning' && "border-warning/50 bg-warning/5",
                                pieza.status === 'ok' && "border-border"
                              )}>
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center gap-2">
                                    <Droplets className={cn("w-4 h-4", pieza.status === 'critical' && "text-destructive", pieza.status === 'warning' && "text-warning", pieza.status === 'ok' && "text-info")} />
                                    <span className="text-sm font-medium">{TIPO_PIEZA_LABELS[pieza.tipo_pieza] || pieza.nombre_pieza}</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-muted-foreground">{pieza.porcentajeActual.toFixed(0)}%</span>
                                    <ArrowRight className="w-3 h-3 text-muted-foreground" />
                                    <span className={cn("text-sm font-bold", pieza.status === 'critical' && "text-destructive", pieza.status === 'warning' && "text-warning", pieza.status === 'ok' && "text-success")}>
                                      {Math.min(100, pieza.porcentajeNuevo).toFixed(0)}%
                                    </span>
                                  </div>
                                </div>
                                <Progress value={Math.min(100, pieza.porcentajeNuevo)} className={cn("h-2", pieza.status === 'critical' && "[&>div]:bg-destructive", pieza.status === 'warning' && "[&>div]:bg-warning", pieza.status === 'ok' && "[&>div]:bg-info")} />
                                <p className="text-xs text-muted-foreground mt-1">{pieza.paginasRestantes.toLocaleString()} páginas restantes</p>
                                {pieza.status === 'critical' && (
                                  <div className="flex items-center gap-1 mt-2 text-destructive text-xs">
                                    <AlertTriangle className="w-3 h-3" />
                                    <span>Esta pieza necesita reemplazo pronto</span>
                                  </div>
                                )}
                              </div>
                            ))}
                          </CardContent>
                        </Card>
                      )}

                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Observaciones (opcional)</Label>
                        <Textarea value={notas} onChange={e => setNotas(e.target.value)} placeholder="Notas adicionales sobre esta lectura..." className="min-h-[80px]" />
                      </div>
                    </>
                  )}

                  <div className="flex justify-end gap-2 pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        const tieneDatos = selectedPrinter || contadorNegro || contadorColor || notas;
                        if (tieneDatos) {
                          if (window.confirm('¿Salir sin guardar? Se perderán los datos ingresados.')) {
                            setDialogOpen(false);
                          }
                        } else {
                          setDialogOpen(false);
                        }
                      }}
                    >
                      Cancelar
                    </Button>
                    <Button type="submit" disabled={saving || !selectedPrinter} className="min-w-[120px]">
                      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><CheckCircle2 className="w-4 h-4 mr-2" />Registrar</>}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {fetchError && !loading ? <FetchErrorState error={fetchError} onRetry={fetchData} /> : <>
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="hover-lift">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-primary/10"><FileText className="w-6 h-6 text-primary" /></div>
                <div><p className="text-sm text-muted-foreground">Total Lecturas</p><p className="text-2xl font-bold">{lecturas.length}</p></div>
              </div>
            </CardContent>
          </Card>
          <Card className="hover-lift">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-success/10"><Printer className="w-6 h-6 text-success" /></div>
                <div><p className="text-sm text-muted-foreground">Impresoras Activas</p><p className="text-2xl font-bold">{impresoras.length}</p></div>
              </div>
            </CardContent>
          </Card>
          <Card className="hover-lift">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-info/10"><Clock className="w-6 h-6 text-info" /></div>
                <div><p className="text-sm text-muted-foreground">Lecturas Hoy</p><p className="text-2xl font-bold">{lecturasHoy}</p></div>
              </div>
            </CardContent>
          </Card>
          <Card className="hover-lift">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-warning/10"><TrendingUp className="w-6 h-6 text-warning" /></div>
                <div><p className="text-sm text-muted-foreground">Páginas Hoy</p><p className="text-2xl font-bold">{totalPaginasHoy.toLocaleString()}</p></div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Cascade Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label className="text-sm">Filial</Label>
                <Select value={filterFilial} onValueChange={v => { setFilterFilial(v); setFilterSector('all'); setFilterModelo('all'); }}>
                  <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
                  <SelectContent className="bg-popover">
                    <SelectItem value="all">Todas las filiales</SelectItem>
                    {filiales.map(f => <SelectItem key={f.id} value={f.id}>{f.nombre}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-sm">Sector</Label>
                <Select value={filterSector} onValueChange={v => { setFilterSector(v); setFilterModelo('all'); }}>
                  <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                  <SelectContent className="bg-popover">
                    <SelectItem value="all">Todos los sectores</SelectItem>
                    {filteredSectores.map(s => <SelectItem key={s.id} value={s.id}>{s.nombre}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-sm">Modelo</Label>
                <Select value={filterModelo} onValueChange={setFilterModelo}>
                  <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                  <SelectContent className="bg-popover">
                    <SelectItem value="all">Todos los modelos</SelectItem>
                    {filteredModelos.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                {hasActiveFilters && (
                  <Button variant="ghost" size="sm" onClick={() => { setFilterFilial('all'); setFilterSector('all'); setFilterModelo('all'); }} className="gap-2 text-destructive hover:text-destructive">
                    Borrar filtros
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs value={activeTab} onValueChange={(value) => setSearchParams((prev) => {
          const next = new URLSearchParams(prev);
          if (value === 'sin-actividad') next.set('tab', 'sin-actividad');
          else next.delete('tab');
          return next;
        })} className="space-y-4">
          <TabsList className="grid w-full grid-cols-2 md:w-[420px]">
            <TabsTrigger value="lecturas">Historial de lecturas</TabsTrigger>
            <TabsTrigger value="sin-actividad">Impresoras sin Actividad</TabsTrigger>
          </TabsList>

          <TabsContent value="lecturas">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-primary" />
                  Historial Rápido de Lecturas
                </CardTitle>
                <CardDescription>Incluye páginas del período por impresora entre lecturas consecutivas</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex justify-center py-8"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
                ) : lecturasConPeriodo.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <FileText className="w-16 h-16 mx-auto mb-4 opacity-30" />
                    <p className="text-lg font-medium">No hay lecturas registradas</p>
                    <p className="text-sm">Comienza registrando la primera lectura de contadores</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Fecha/Hora</TableHead>
                          <TableHead>Filial</TableHead>
                          <TableHead>Sector</TableHead>
                          <TableHead>Impresora</TableHead>
                          <TableHead>Modelo</TableHead>
                          <TableHead>Serie</TableHead>
                          <TableHead className="text-right">Negro</TableHead>
                          <TableHead className="text-right">Color</TableHead>
                          <TableHead className="text-right">B/N Período</TableHead>
                          <TableHead className="text-right">Color Período</TableHead>
                          <TableHead className="text-right">Total Período</TableHead>
                          <TableHead>Notas</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {lecturasConPeriodo.slice(0, 20).map((lectura) => (
                          <TableRow key={lectura.id} className="hover:bg-muted/50">
                            <TableCell className="whitespace-nowrap">
                              {new Date(lectura.fecha_lectura).toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' })}
                              <br />
                              <span className="text-xs text-muted-foreground">
                                {new Date(lectura.fecha_lectura).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </TableCell>
                            <TableCell className="text-muted-foreground">{getFilialName(lectura.impresoras?.filial_id || null)}</TableCell>
                            <TableCell className="text-muted-foreground">{getSectorName(lectura.impresoras?.sector_id || null)}</TableCell>
                            <TableCell className="font-medium">{lectura.impresoras?.nombre || '-'}</TableCell>
                            <TableCell>{lectura.impresoras?.modelo || '-'}</TableCell>
                            <TableCell className="font-mono text-sm text-muted-foreground">{lectura.impresoras?.serie || '-'}</TableCell>
                            <TableCell className="text-right font-medium">{lectura.contador_negro?.toLocaleString() ?? '-'}</TableCell>
                            <TableCell className="text-right font-medium">{lectura.contador_color?.toLocaleString() ?? '-'}</TableCell>
                            {lectura.periodoTotal === null ? (
                              <TableCell colSpan={3} className="text-right text-muted-foreground">Primera lectura</TableCell>
                            ) : (
                              <>
                                <TableCell className="text-right text-info">+{lectura.periodoNegro?.toLocaleString()}</TableCell>
                                <TableCell className="text-right text-success">+{lectura.periodoColor?.toLocaleString()}</TableCell>
                                <TableCell className={cn('text-right font-semibold', lectura.isHigh ? 'text-warning' : 'text-success')}>
                                  +{lectura.periodoTotal?.toLocaleString()}
                                </TableCell>
                              </>
                            )}
                            <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">{lectura.notas || '-'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="sin-actividad">
            <InactivityPanel
              impresoras={impresoras}
              lecturas={lecturas}
              sectores={sectores}
              filiales={filiales}
              onRegister={(printerId) => {
                setSelectedPrinter(printerId);
                setSearchParams((prev) => {
                  const next = new URLSearchParams(prev);
                  next.delete('tab');
                  next.set('impresora', printerId);
                  return next;
                });
                setDialogOpen(true);
              }}
            />
          </TabsContent>
        </Tabs>
        </>}
      </div>
    </DashboardLayout>
  );
}
