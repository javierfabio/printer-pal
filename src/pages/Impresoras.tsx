import { useEffect, useMemo, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Search, Edit, History, Loader2, Printer, Download, FileText, FileWarning, Wrench, X, QrCode, Columns } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { generateQRPDF, generateQRBulkPDF } from '@/lib/qrUtils';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { addPDFHeader, addPDFPageNumbers } from '@/lib/pdfHeader';
import { PrinterHistoryDialog } from '@/components/impresoras/PrinterHistoryDialog';
import { RepairOutDialog } from '@/components/impresoras/RepairOutDialog';
import { RepairReturnDialog } from '@/components/impresoras/RepairReturnDialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { z } from 'zod';
import { useSearchParams } from 'react-router-dom';
import { FetchErrorState } from '@/components/ui/fetch-error-state';

type TipoConsumo = 'tinta' | 'toner';

// IDs y labels de todas las columnas configurables
const COLUMN_DEFS = [
  { id: 'serie',      label: 'Serie',      defaultVisible: true  },
  { id: 'nombre',     label: 'Nombre',     defaultVisible: true  },
  { id: 'modelo',     label: 'Modelo',     defaultVisible: true  },
  { id: 'tipo',       label: 'Tipo',       defaultVisible: true  },
  { id: 'consumo',    label: 'Consumo',    defaultVisible: false },
  { id: 'filial',     label: 'Filial',     defaultVisible: true  },
  { id: 'sector',     label: 'Sector',     defaultVisible: true  },
  { id: 'estado',     label: 'Estado',     defaultVisible: true  },
  { id: 'ip',         label: 'IP',         defaultVisible: false },
  { id: 'contadores', label: 'Contadores', defaultVisible: true  },
] as const;

type ColumnId = typeof COLUMN_DEFS[number]['id'];

const COLUMNS_STORAGE_KEY = 'printcontrol_impresoras_columns';

function getStoredColumns(): Record<ColumnId, boolean> {
  const defaults = Object.fromEntries(
    COLUMN_DEFS.map(c => [c.id, c.defaultVisible])
  ) as Record<ColumnId, boolean>;
  try {
    const saved = localStorage.getItem(COLUMNS_STORAGE_KEY);
    if (saved) return { ...defaults, ...JSON.parse(saved) };
  } catch {}
  return defaults;
}

type TipoImpresion = 'monocromatico' | 'color';
type EstadoImpresora = 'activa' | 'inactiva' | 'en_reparacion' | 'baja';

interface Impresora {
  id: string;
  serie: string;
  nombre: string;
  modelo: string;
  tipo_consumo: TipoConsumo;
  tipo_impresion: TipoImpresion;
  sector_id: string | null;
  filial_id: string | null;
  contador_negro_inicial: number;
  contador_color_inicial: number;
  contador_negro_actual: number;
  contador_color_actual: number;
  fecha_registro: string;
  descripcion: string | null;
  estado: EstadoImpresora;
  editado_por: string | null;
  lectura_ip: boolean;
  ip_address: string | null;
}

interface Sector { id: string; nombre: string; }
interface Filial { id: string; nombre: string; }

const impresoraSchema = z.object({
  serie: z.string().min(1, 'La serie es requerida').max(50),
  nombre: z.string().min(1, 'El nombre es requerido').max(100),
  modelo: z.string().min(1, 'El modelo es requerido').max(100),
  tipo_consumo: z.enum(['tinta', 'toner']),
  tipo_impresion: z.enum(['monocromatico', 'color']),
  sector_id: z.string().optional().nullable(),
  filial_id: z.string().optional().nullable(),
  contador_negro_inicial: z.number().min(0),
  contador_color_inicial: z.number().min(0),
  descripcion: z.string().max(500).optional().nullable(),
  estado: z.enum(['activa', 'inactiva', 'en_reparacion', 'baja']),
});

export default function Impresoras() {
  const { user, role } = useAuth();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const [impresoras, setImpresoras] = useState<Impresora[]>([]);
  const [sectores, setSectores] = useState<Sector[]>([]);
  const [filiales, setFiliales] = useState<Filial[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [filterSinLectura, setFilterSinLectura] = useState(false);
  const [printersSinLectura, setPrintersSinLectura] = useState<Set<string>>(new Set());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPrinter, setEditingPrinter] = useState<Impresora | null>(null);
  const [historialOpen, setHistorialOpen] = useState(false);
  const [selectedPrinterId, setSelectedPrinterId] = useState<string | null>(null);
  const [selectedPrinterName, setSelectedPrinterName] = useState<string>('');
  const [historialInitialTab, setHistorialInitialTab] = useState<string>('general');
  const [repairOutOpen, setRepairOutOpen] = useState(false);
  const [repairReturnOpen, setRepairReturnOpen] = useState(false);
  const [pendingRepairPrinter, setPendingRepairPrinter] = useState<{ id: string; name: string } | null>(null);

  const [visibleColumns, setVisibleColumns] = useState<Record<ColumnId, boolean>>(getStoredColumns);

  const toggleColumn = (id: ColumnId) => {
    setVisibleColumns(prev => {
      const updated = { ...prev, [id]: !prev[id] };
      localStorage.setItem(COLUMNS_STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  };

  const showCol = (id: ColumnId) => visibleColumns[id];

  const [formData, setFormData] = useState({
    serie: '',
    nombre: '',
    modelo: '',
    tipo_consumo: 'tinta' as TipoConsumo,
    tipo_impresion: 'color' as TipoImpresion,
    sector_id: '',
    filial_id: '',
    contador_negro_inicial: 0,
    contador_color_inicial: 0,
    descripcion: '',
    estado: 'activa' as EstadoImpresora,
    lectura_ip: false,
    ip_address: '',
  });

  const [newSectorOpen, setNewSectorOpen] = useState(false);
  const [newFilialOpen, setNewFilialOpen] = useState(false);
  const [newSectorName, setNewSectorName] = useState('');
  const [newFilialName, setNewFilialName] = useState('');

  const [sectorSearch, setSectorSearch] = useState('');
  const [filialSearch, setFilialSearch] = useState('');

  const sectoresFiltrados = useMemo(() =>
    sectores
      .filter(s => s.nombre.toLowerCase().includes(sectorSearch.toLowerCase()))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
    [sectores, sectorSearch]
  );
  const filialesFiltradas = useMemo(() =>
    filiales
      .filter(f => f.nombre.toLowerCase().includes(filialSearch.toLowerCase()))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
    [filiales, filialSearch]
  );

  useEffect(() => { fetchData(); }, []);

  useEffect(() => {
    const filialFromQuery = searchParams.get('filial');
    if (!filialFromQuery) return;
    setSearch('');
  }, [searchParams]);

  const fetchData = async () => {
    setLoading(true);
    setFetchError(null);
    try {
    const [impResp, secResp, filResp, lectResp] = await Promise.all([
      supabase.from('impresoras').select('*, sectores(nombre), filiales(nombre)').order('created_at', { ascending: false }),
      supabase.from('sectores').select('*').eq('activo', true),
      supabase.from('filiales').select('*').eq('activo', true),
      supabase.from('lecturas_contadores').select('impresora_id'),
    ]);
    if (impResp.data) setImpresoras(impResp.data as any[]);
    if (secResp.data) setSectores(secResp.data);
    if (filResp.data) setFiliales(filResp.data);
    if (lectResp.data) {
      const idsConLectura = new Set(impResp.data?.map(i => i.id) || []);
      const setIds = new Set(lectResp.data.map((r: any) => r.impresora_id));
      const sinLect = new Set<string>();
      idsConLectura.forEach(id => { if (!setIds.has(id)) sinLect.add(id); });
      setPrintersSinLectura(sinLect);
    }
    } catch (error) {
      console.error('Error al cargar datos:', error);
      setFetchError('No se pudieron cargar los datos. Verificá tu conexión.');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({ serie: '', nombre: '', modelo: '', tipo_consumo: 'tinta', tipo_impresion: 'color', sector_id: '', filial_id: '', contador_negro_inicial: 0, contador_color_inicial: 0, descripcion: '', estado: 'activa', lectura_ip: false, ip_address: '' });
    setEditingPrinter(null);
  };

  const handleEdit = (printer: Impresora) => {
    setEditingPrinter(printer);
    setFormData({
      serie: printer.serie,
      nombre: printer.nombre,
      modelo: printer.modelo,
      tipo_consumo: printer.tipo_consumo,
      tipo_impresion: printer.tipo_impresion,
      sector_id: printer.sector_id || '',
      filial_id: printer.filial_id || '',
      contador_negro_inicial: printer.contador_negro_inicial,
      contador_color_inicial: printer.contador_color_inicial,
      descripcion: printer.descripcion || '',
      estado: printer.estado,
      lectura_ip: printer.lectura_ip || false,
      ip_address: printer.ip_address || '',
    });
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validation = impresoraSchema.safeParse({
      ...formData,
      sector_id: formData.sector_id || null,
      filial_id: formData.filial_id || null,
      descripcion: formData.descripcion || null,
    });
    if (!validation.success) {
      toast({ variant: 'destructive', title: 'Error de validación', description: validation.error.errors[0].message });
      return;
    }

    setSaving(true);
    const dataToSave = {
      ...formData,
      sector_id: formData.sector_id || null,
      filial_id: formData.filial_id || null,
      descripcion: formData.descripcion || null,
      editado_por: user?.id,
      ip_address: formData.lectura_ip ? (formData.ip_address || null) : null,
    };

    if (editingPrinter) {
      const wasRepair = editingPrinter.estado === 'en_reparacion';
      const willBeRepair = dataToSave.estado === 'en_reparacion';
      const transitionToRepair = !wasRepair && willBeRepair;
      const transitionFromRepair = wasRepair && !willBeRepair;

      const fieldsToTrack: { campo: string; anterior: () => string; nuevo: () => string; changed: boolean }[] = [
        { campo: 'sector', anterior: () => sectores.find(s => s.id === editingPrinter.sector_id)?.nombre || 'Sin sector', nuevo: () => sectores.find(s => s.id === dataToSave.sector_id)?.nombre || 'Sin sector', changed: editingPrinter.sector_id !== dataToSave.sector_id },
        { campo: 'filial', anterior: () => filiales.find(f => f.id === editingPrinter.filial_id)?.nombre || 'Sin filial', nuevo: () => filiales.find(f => f.id === dataToSave.filial_id)?.nombre || 'Sin filial', changed: editingPrinter.filial_id !== dataToSave.filial_id },
        { campo: 'nombre', anterior: () => editingPrinter.nombre, nuevo: () => dataToSave.nombre, changed: editingPrinter.nombre !== dataToSave.nombre },
        { campo: 'modelo', anterior: () => editingPrinter.modelo, nuevo: () => dataToSave.modelo, changed: editingPrinter.modelo !== dataToSave.modelo },
        { campo: 'tipo_consumo', anterior: () => editingPrinter.tipo_consumo, nuevo: () => dataToSave.tipo_consumo, changed: editingPrinter.tipo_consumo !== dataToSave.tipo_consumo },
        { campo: 'tipo_impresion', anterior: () => editingPrinter.tipo_impresion, nuevo: () => dataToSave.tipo_impresion, changed: editingPrinter.tipo_impresion !== dataToSave.tipo_impresion },
        { campo: 'descripcion', anterior: () => editingPrinter.descripcion || '', nuevo: () => dataToSave.descripcion || '', changed: (editingPrinter.descripcion || '') !== (dataToSave.descripcion || '') },
        { campo: 'lectura_ip', anterior: () => editingPrinter.lectura_ip ? 'Sí' : 'No', nuevo: () => dataToSave.lectura_ip ? 'Sí' : 'No', changed: editingPrinter.lectura_ip !== dataToSave.lectura_ip },
        { campo: 'ip_address', anterior: () => editingPrinter.ip_address || '', nuevo: () => dataToSave.ip_address || '', changed: (editingPrinter.ip_address || '') !== (dataToSave.ip_address || '') },
      ];
      // Solo loguear el estado en historial_cambios si NO es transición de/hacia reparación
      // (esas transiciones se loguean en repair_history vía los modales).
      if (!transitionToRepair && !transitionFromRepair && editingPrinter.estado !== dataToSave.estado) {
        fieldsToTrack.push({ campo: 'estado', anterior: () => editingPrinter.estado, nuevo: () => dataToSave.estado, changed: true });
      }
      const changes = fieldsToTrack.filter(f => f.changed).map(f => ({ campo: f.campo, anterior: f.anterior(), nuevo: f.nuevo() }));

      // Si la transición involucra reparación, NO actualizamos el estado todavía;
      // el modal lo hará al confirmarse.
      const updatePayload: any = {
        ...dataToSave,
        contador_negro_actual: editingPrinter.contador_negro_actual,
        contador_color_actual: editingPrinter.contador_color_actual,
      };
      if (transitionToRepair || transitionFromRepair) {
        updatePayload.estado = editingPrinter.estado;
      }

      const { error } = await supabase.from('impresoras').update(updatePayload).eq('id', editingPrinter.id);

      if (error) { toast({ variant: 'destructive', title: 'Error', description: error.message }); }
      else {
        for (const change of changes) {
          await supabase.from('historial_cambios').insert({ impresora_id: editingPrinter.id, campo_modificado: change.campo, valor_anterior: change.anterior, valor_nuevo: change.nuevo, usuario_id: user?.id });
        }
        if (transitionToRepair) {
          setPendingRepairPrinter({ id: editingPrinter.id, name: editingPrinter.nombre });
          setRepairOutOpen(true);
        } else if (transitionFromRepair) {
          setPendingRepairPrinter({ id: editingPrinter.id, name: editingPrinter.nombre });
          setRepairReturnOpen(true);
        } else {
          toast({ title: 'Éxito', description: 'Impresora actualizada correctamente' });
        }
      }
    } else {
      const { error } = await supabase.from('impresoras').insert({
        ...dataToSave,
        contador_negro_actual: dataToSave.contador_negro_inicial,
        contador_color_actual: dataToSave.contador_color_inicial,
      });
      if (error) {
        if (error.message.includes('duplicate key')) toast({ variant: 'destructive', title: 'Error', description: 'Ya existe una impresora con esa serie' });
        else toast({ variant: 'destructive', title: 'Error', description: error.message });
      } else toast({ title: 'Éxito', description: 'Impresora registrada correctamente' });
    }

    setSaving(false);
    setDialogOpen(false);
    resetForm();
    fetchData();
  };

  const handleAddSector = async () => {
    if (!newSectorName.trim()) return;
    const { data, error } = await supabase.from('sectores').insert({ nombre: newSectorName.trim() }).select().single();
    if (error) toast({ variant: 'destructive', title: 'Error', description: error.message });
    else if (data) { setSectores([...sectores, data]); setFormData({ ...formData, sector_id: data.id }); setNewSectorOpen(false); setNewSectorName(''); toast({ title: 'Éxito', description: 'Sector creado' }); }
  };

  const handleAddFilial = async () => {
    if (!newFilialName.trim()) return;
    const { data, error } = await supabase.from('filiales').insert({ nombre: newFilialName.trim() }).select().single();
    if (error) toast({ variant: 'destructive', title: 'Error', description: error.message });
    else if (data) { setFiliales([...filiales, data]); setFormData({ ...formData, filial_id: data.id }); setNewFilialOpen(false); setNewFilialName(''); toast({ title: 'Éxito', description: 'Filial creada' }); }
  };

  const openHistorial = (printer: Impresora) => {
    setSelectedPrinterId(printer.id);
    setSelectedPrinterName(`${printer.nombre} — ${printer.serie}`);
    setHistorialInitialTab(printer.estado === 'en_reparacion' ? 'reparaciones' : 'general');
    setHistorialOpen(true);
  };

  const filteredImpresoras = useMemo(() => {
    const filialFromQuery = searchParams.get('filial');
    return impresoras.filter(imp => {
      const q = search.toLowerCase();
      const sectorNombre = (imp as any).sectores?.nombre?.toLowerCase() || '';
      const filialNombre = (imp as any).filiales?.nombre?.toLowerCase() || '';
      const matchesSearch = !search || (
        imp.nombre.toLowerCase().includes(q) ||
        imp.serie.toLowerCase().includes(q) ||
        imp.modelo.toLowerCase().includes(q) ||
        sectorNombre.includes(q) ||
        filialNombre.includes(q) ||
        imp.tipo_consumo.toLowerCase().includes(q) ||
        imp.tipo_impresion.toLowerCase().includes(q) ||
        imp.estado.toLowerCase().includes(q)
      );
      const matchesSinLectura = !filterSinLectura || printersSinLectura.has(imp.id);
      const matchesFilial = !filialFromQuery || imp.filial_id === filialFromQuery;
      return matchesSearch && matchesSinLectura && matchesFilial;
    });
  }, [filterSinLectura, impresoras, printersSinLectura, search, searchParams]);

  const getStatusBadge = (estado: EstadoImpresora) => {
    const statusMap: Record<EstadoImpresora, { label: string; className: string }> = {
      activa: { label: 'Activa', className: 'status-active' },
      inactiva: { label: 'Inactiva', className: 'status-inactive' },
      en_reparacion: { label: 'En Reparación', className: 'status-repair' },
      baja: { label: 'Baja', className: 'status-disabled' },
    };
    const status = statusMap[estado];
    return <span className={cn('px-2 py-1 rounded-full text-xs font-medium border', status.className)}>{status.label}</span>;
  };

  const exportImpresorasCSV = () => {
    const data = filteredImpresoras.map(imp => ({
      Serie: imp.serie, Nombre: imp.nombre, Modelo: imp.modelo, TipoImpresion: imp.tipo_impresion, TipoConsumo: imp.tipo_consumo, Estado: imp.estado,
      Sector: (imp as any).sectores?.nombre || '-', Filial: (imp as any).filiales?.nombre || '-', ContadorNegro: imp.contador_negro_actual, ContadorColor: imp.contador_color_actual,
      LecturaIP: imp.lectura_ip ? 'Sí' : 'No',
    }));
    if (data.length === 0) return;
    const headers = Object.keys(data[0]).join(',');
    const rows = data.map(row => Object.values(row).map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob([`${headers}\n${rows}`], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `impresoras_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    toast({ title: 'Exportado' });
  };

  const exportImpresorasPDF = () => {
    const doc = new jsPDF('landscape');
    const startY = addPDFHeader(doc, 'Listado de Impresoras', `Total: ${filteredImpresoras.length} impresoras`);
    autoTable(doc, {
      startY, head: [['Serie', 'Nombre', 'Modelo', 'Tipo Imp.', 'Consumo', 'Estado', 'Filial', 'Sector', 'Negro', 'Color']],
      body: filteredImpresoras.map(imp => [imp.serie, imp.nombre, imp.modelo, imp.tipo_impresion === 'color' ? 'Color' : 'Monocromático', imp.tipo_consumo === 'toner' ? 'Tóner' : 'Tinta', imp.estado, (imp as any).filiales?.nombre || '-', (imp as any).sectores?.nombre || '-', imp.contador_negro_actual?.toLocaleString() ?? '-', imp.contador_color_actual?.toLocaleString() ?? '-']),
      theme: 'striped', headStyles: { fillColor: [59, 130, 246], textColor: 255 }, styles: { fontSize: 7 },
    });
    addPDFPageNumbers(doc);
    doc.save(`impresoras_${new Date().toISOString().split('T')[0]}.pdf`);
    toast({ title: 'PDF Generado' });
  };

  const isAdmin = role === 'admin';

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold">Impresoras</h1>
            <p className="text-muted-foreground">Gestión y registro de equipos</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={exportImpresorasCSV} variant="outline" className="gap-2"><Download className="w-4 h-4" />CSV</Button>
            <Button onClick={exportImpresorasPDF} variant="outline" className="gap-2"><FileText className="w-4 h-4" />PDF</Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <Columns className="w-4 h-4" />
                  Columnas
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuLabel className="text-xs text-muted-foreground">
                  Mostrar columnas
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {COLUMN_DEFS.map(col => (
                  <DropdownMenuCheckboxItem
                    key={col.id}
                    checked={visibleColumns[col.id]}
                    onCheckedChange={() => toggleColumn(col.id)}
                  >
                    {col.label}
                  </DropdownMenuCheckboxItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuCheckboxItem
                  checked={Object.values(visibleColumns).every(Boolean)}
                  onCheckedChange={() => {
                    const allVisible = Object.fromEntries(
                      COLUMN_DEFS.map(c => [c.id, true])
                    ) as Record<ColumnId, boolean>;
                    setVisibleColumns(allVisible);
                    localStorage.setItem(COLUMNS_STORAGE_KEY, JSON.stringify(allVisible));
                  }}
                >
                  Mostrar todas
                </DropdownMenuCheckboxItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              variant="outline"
              className="gap-2"
              onClick={async () => {
                if (filteredImpresoras.length === 0) return;
                toast({ title: 'Generando QRs...', description: `${filteredImpresoras.length} etiquetas` });
                await generateQRBulkPDF(filteredImpresoras.map((imp: any) => ({
                  id: imp.id,
                  serie: imp.serie,
                  nombre: imp.nombre,
                  modelo: imp.modelo,
                  filial: imp.filiales?.nombre || '',
                  sector: imp.sectores?.nombre || '',
                })));
              }}
            >
              <QrCode className="w-4 h-4" />
              QR ({filteredImpresoras.length})
            </Button>
            {isAdmin && (
              <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
                <DialogTrigger asChild>
                  <Button className="gap-2"><Plus className="w-4 h-4" />Nueva Impresora</Button>
                </DialogTrigger>
                <DialogContent
                  className="max-w-2xl max-h-[90vh] overflow-y-auto"
                  onInteractOutside={(e) => e.preventDefault()}
                  onEscapeKeyDown={(e) => e.preventDefault()}
                >
                  <DialogHeader>
                    <DialogTitle>{editingPrinter ? 'Editar Impresora' : 'Registrar Nueva Impresora'}</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="serie">Serie (Único) *</Label>
                        <Input id="serie" value={formData.serie} onChange={e => setFormData({ ...formData, serie: e.target.value })} placeholder="SN-123456" required disabled={!!editingPrinter} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="nombre">Nombre *</Label>
                        <Input id="nombre" value={formData.nombre} onChange={e => setFormData({ ...formData, nombre: e.target.value })} placeholder="Impresora Principal" required />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="modelo">Modelo *</Label>
                        <Input id="modelo" value={formData.modelo} onChange={e => setFormData({ ...formData, modelo: e.target.value })} placeholder="HP LaserJet Pro" required />
                      </div>
                      <div className="space-y-2">
                        <Label>Tipo de Consumo *</Label>
                        <Select value={formData.tipo_consumo} onValueChange={v => setFormData({ ...formData, tipo_consumo: v as TipoConsumo })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent><SelectItem value="tinta">Tinta</SelectItem><SelectItem value="toner">Tóner</SelectItem></SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Tipo de Impresión *</Label>
                        <Select value={formData.tipo_impresion} onValueChange={v => setFormData({ ...formData, tipo_impresion: v as TipoImpresion })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent><SelectItem value="monocromatico">Monocromático</SelectItem><SelectItem value="color">Color</SelectItem></SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Estado *</Label>
                        <Select value={formData.estado} onValueChange={v => setFormData({ ...formData, estado: v as EstadoImpresora })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent><SelectItem value="activa">Activa</SelectItem><SelectItem value="inactiva">Inactiva</SelectItem><SelectItem value="en_reparacion">En Reparación</SelectItem><SelectItem value="baja">Baja</SelectItem></SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center"><Label>Filial</Label><Button type="button" variant="ghost" size="sm" onClick={() => setNewFilialOpen(true)}>+ Nueva</Button></div>
                        <Select
                          value={formData.filial_id}
                          onValueChange={v => setFormData({ ...formData, filial_id: v })}
                          onOpenChange={() => setFilialSearch('')}
                        >
                          <SelectTrigger><SelectValue placeholder="Seleccionar filial" /></SelectTrigger>
                          <SelectContent className="bg-popover p-0">
                            <div className="px-2 pt-2 pb-1 sticky top-0 bg-popover border-b border-border z-10">
                              <div className="flex items-center gap-2 px-2 py-1 rounded-md border border-input bg-background">
                                <Search className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                                <input
                                  placeholder="Buscar filial..."
                                  value={filialSearch}
                                  onChange={e => setFilialSearch(e.target.value)}
                                  onClick={e => e.stopPropagation()}
                                  onKeyDown={e => e.stopPropagation()}
                                  className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                                  autoComplete="off"
                                />
                                {filialSearch && (
                                  <button type="button" onClick={() => setFilialSearch('')} className="text-muted-foreground hover:text-foreground">
                                    <X className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                            </div>
                            <div className="max-h-52 overflow-y-auto py-1">
                              {filialesFiltradas.length === 0 ? (
                                <div className="px-3 py-3 text-sm text-muted-foreground text-center">Sin resultados para "{filialSearch}"</div>
                              ) : (
                                filialesFiltradas.map(f => <SelectItem key={f.id} value={f.id}>{f.nombre}</SelectItem>)
                              )}
                            </div>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center"><Label>Sector</Label><Button type="button" variant="ghost" size="sm" onClick={() => setNewSectorOpen(true)}>+ Nuevo</Button></div>
                        <Select
                          value={formData.sector_id}
                          onValueChange={v => setFormData({ ...formData, sector_id: v })}
                          onOpenChange={() => setSectorSearch('')}
                        >
                          <SelectTrigger><SelectValue placeholder="Seleccionar sector" /></SelectTrigger>
                          <SelectContent className="bg-popover p-0">
                            <div className="px-2 pt-2 pb-1 sticky top-0 bg-popover border-b border-border z-10">
                              <div className="flex items-center gap-2 px-2 py-1 rounded-md border border-input bg-background">
                                <Search className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                                <input
                                  placeholder="Buscar sector..."
                                  value={sectorSearch}
                                  onChange={e => setSectorSearch(e.target.value)}
                                  onClick={e => e.stopPropagation()}
                                  onKeyDown={e => e.stopPropagation()}
                                  className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                                  autoComplete="off"
                                />
                                {sectorSearch && (
                                  <button type="button" onClick={() => setSectorSearch('')} className="text-muted-foreground hover:text-foreground">
                                    <X className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                            </div>
                            <div className="max-h-52 overflow-y-auto py-1">
                              {sectoresFiltrados.length === 0 ? (
                                <div className="px-3 py-3 text-sm text-muted-foreground text-center">Sin resultados para "{sectorSearch}"</div>
                              ) : (
                                sectoresFiltrados.map(s => <SelectItem key={s.id} value={s.id}>{s.nombre}</SelectItem>)
                              )}
                            </div>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="contador_negro">Contador Negro Inicial</Label>
                        <Input id="contador_negro" type="number" min="0" value={formData.contador_negro_inicial} onChange={e => setFormData({ ...formData, contador_negro_inicial: parseInt(e.target.value) || 0 })} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="contador_color">Contador Color Inicial</Label>
                        <Input id="contador_color" type="number" min="0" value={formData.contador_color_inicial} onChange={e => setFormData({ ...formData, contador_color_inicial: parseInt(e.target.value) || 0 })} disabled={formData.tipo_impresion === 'monocromatico'} />
                      </div>
                    </div>

                    {/* IP Reading */}
                    <div className="p-4 rounded-lg border bg-muted/30 space-y-3">
                      <div className="flex items-center space-x-2">
                        <Checkbox id="lectura_ip" checked={formData.lectura_ip} onCheckedChange={(checked) => setFormData({ ...formData, lectura_ip: !!checked, ip_address: checked ? formData.ip_address : '' })} />
                        <Label htmlFor="lectura_ip" className="cursor-pointer">Lectura automática por IP</Label>
                      </div>
                      {formData.lectura_ip && (
                        <div className="space-y-2">
                          <Label>IP de impresora *</Label>
                          <Input value={formData.ip_address} onChange={e => setFormData({ ...formData, ip_address: e.target.value })} placeholder="192.168.1.45" pattern="^(?:\d{1,3}\.){3}\d{1,3}$" />
                          <p className="text-xs text-muted-foreground">Usado para lectura automática (ej: impresoras Ricoh en red)</p>
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="descripcion">Descripción</Label>
                      <Textarea id="descripcion" value={formData.descripcion} onChange={e => setFormData({ ...formData, descripcion: e.target.value })} placeholder="Notas adicionales..." rows={3} />
                    </div>
                    <div className="flex justify-end gap-2 pt-4">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          const tieneDatos = formData.nombre || formData.serie || formData.modelo;
                          if (tieneDatos && !editingPrinter) {
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
                      <Button type="submit" disabled={saving}>{saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}{editingPrinter ? 'Guardar Cambios' : 'Registrar'}</Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>

        {fetchError && !loading ? <FetchErrorState error={fetchError} onRetry={fetchData} /> : <>
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Buscar por nombre, serie, modelo, sector o filial..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
              </div>
              <Button
                variant={filterSinLectura ? 'default' : 'outline'}
                onClick={() => setFilterSinLectura(v => !v)}
                className={cn("gap-2 flex-shrink-0", filterSinLectura && "bg-warning hover:bg-warning/90 text-warning-foreground")}
              >
                <FileWarning className="w-4 h-4" />
                Sin lecturas ({printersSinLectura.size})
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Printer className="w-5 h-5" />Lista de Impresoras ({filteredImpresoras.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
            ) : filteredImpresoras.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground"><Printer className="w-12 h-12 mx-auto mb-2 opacity-50" /><p>No se encontraron impresoras</p></div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Serie</TableHead>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Modelo</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Consumo</TableHead>
                      <TableHead>Filial</TableHead>
                      <TableHead>Sector</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>IP</TableHead>
                      <TableHead>Contadores</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredImpresoras.map((imp) => (
                      <TableRow
                        key={imp.id}
                        className={cn(
                          "hover:bg-muted/50 transition-colors cursor-pointer",
                          imp.estado === 'en_reparacion' && "bg-warning/5 border-l-4 border-l-warning",
                          imp.estado === 'baja' && "opacity-50",
                        )}
                        onClick={() => openHistorial(imp)}
                      >
                        <TableCell className="font-mono text-sm">{imp.serie}</TableCell>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {imp.estado === 'en_reparacion' && (
                              <span className="inline-flex items-center gap-1 text-[10px] text-warning font-medium">
                                <Wrench className="w-3 h-3" />En reparación
                              </span>
                            )}
                            <span>{imp.nombre}</span>
                            {printersSinLectura.has(imp.id) && (
                              <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-warning/15 text-warning border border-warning/30 flex items-center gap-1">
                                <FileWarning className="w-3 h-3" />Sin registro
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{imp.modelo}</TableCell>
                        <TableCell className="capitalize">{imp.tipo_impresion}</TableCell>
                        <TableCell className="capitalize">{imp.tipo_consumo}</TableCell>
                        <TableCell className="text-muted-foreground">{(imp as any).filiales?.nombre || '-'}</TableCell>
                        <TableCell className="text-muted-foreground">{(imp as any).sectores?.nombre || '-'}</TableCell>
                        <TableCell>{getStatusBadge(imp.estado)}</TableCell>
                        <TableCell className="text-muted-foreground text-xs">{imp.lectura_ip ? imp.ip_address || 'Sí' : '-'}</TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {imp.tipo_impresion === 'color' ? (
                              <><span className="text-muted-foreground">Color:</span> {imp.contador_color_actual}{imp.tipo_consumo === 'toner' && (<> / <span className="text-muted-foreground">B/N:</span> {imp.contador_negro_actual}</>)}</>
                            ) : (
                              <><span className="text-muted-foreground">B/N:</span> {imp.contador_negro_actual}</>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex justify-end gap-1">
                            {isAdmin && <Button variant="ghost" size="icon" onClick={() => handleEdit(imp)}><Edit className="w-4 h-4" /></Button>}
                            <Button variant="ghost" size="icon" onClick={() => openHistorial(imp)}><History className="w-4 h-4" /></Button>
                            <Button variant="ghost" size="icon" title="Generar etiqueta QR" onClick={async () => {
                              await generateQRPDF({
                                id: imp.id,
                                serie: imp.serie,
                                nombre: imp.nombre,
                                modelo: imp.modelo,
                                filial: (imp as any).filiales?.nombre || '',
                                sector: (imp as any).sectores?.nombre || '',
                              });
                            }}><QrCode className="w-4 h-4" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog open={newSectorOpen} onOpenChange={setNewSectorOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Nuevo Sector</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <Input placeholder="Nombre del sector" value={newSectorName} onChange={e => setNewSectorName(e.target.value)} />
              <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setNewSectorOpen(false)}>Cancelar</Button><Button onClick={handleAddSector}>Crear</Button></div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={newFilialOpen} onOpenChange={setNewFilialOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Nueva Filial</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <Input placeholder="Nombre de la filial" value={newFilialName} onChange={e => setNewFilialName(e.target.value)} />
              <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setNewFilialOpen(false)}>Cancelar</Button><Button onClick={handleAddFilial}>Crear</Button></div>
            </div>
          </DialogContent>
        </Dialog>

        <PrinterHistoryDialog printerId={selectedPrinterId} printerName={selectedPrinterName} open={historialOpen} onOpenChange={setHistorialOpen} initialTab={historialInitialTab} />

        {pendingRepairPrinter && (
          <>
            <RepairOutDialog
              open={repairOutOpen}
              onOpenChange={setRepairOutOpen}
              printerId={pendingRepairPrinter.id}
              printerName={pendingRepairPrinter.name}
              onSuccess={fetchData}
            />
            <RepairReturnDialog
              open={repairReturnOpen}
              onOpenChange={setRepairReturnOpen}
              printerId={pendingRepairPrinter.id}
              printerName={pendingRepairPrinter.name}
              onSuccess={fetchData}
            />
          </>
        )}
        </>}
      </div>
    </DashboardLayout>
  );
}
