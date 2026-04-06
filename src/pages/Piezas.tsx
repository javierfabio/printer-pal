import { useEffect, useState } from 'react';
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
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Plus, 
  Loader2, 
  Wrench, 
  AlertTriangle, 
  RefreshCw,
  CheckCircle2,
  History,
  Settings,
  Printer,
  Pencil,
  Download,
  FileText,
  Package,
  Search
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { addPDFHeader, addPDFPageNumbers } from '@/lib/pdfHeader';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { EditPiezaDialog } from '@/components/piezas/EditPiezaDialog';
import { EditConfiguracionDialog } from '@/components/piezas/EditConfiguracionDialog';

type TipoPieza = 'toner_negro' | 'toner_color' | 'fusor' | 'unidad_imagen' | 'malla' | 'transfer_belt' | 'rodillo' | 'otro';

interface PiezaImpresora {
  id: string;
  impresora_id: string;
  tipo_pieza: TipoPieza;
  nombre_pieza: string;
  vida_util_estimada: number;
  contador_instalacion: number;
  paginas_consumidas: number;
  fecha_instalacion: string;
  activo: boolean;
  notas: string | null;
  impresoras?: {
    nombre: string;
    serie: string;
    contador_negro_actual: number;
    contador_color_actual: number;
  };
}

interface HistorialPieza {
  id: string;
  impresora_id: string;
  tipo_pieza: TipoPieza;
  nombre_pieza: string;
  contador_cambio: number;
  vida_util_real: number | null;
  vida_util_estimada: number;
  porcentaje_vida_consumida: number | null;
  fecha_cambio: string;
  motivo: string | null;
  observaciones: string | null;
  tecnico_id: string | null;
  impresoras?: {
    nombre: string;
    serie: string;
  };
}

interface ConfiguracionPieza {
  id: string;
  tipo_pieza: TipoPieza;
  nombre_display: string;
  vida_util_default: number;
  umbral_advertencia: number;
  umbral_critico: number;
  activo: boolean;
}

interface Impresora {
  id: string;
  nombre: string;
  serie: string;
  modelo: string;
  contador_negro_actual: number;
  contador_color_actual: number;
  tipo_impresion: string;
}

interface PiezaCatalogo {
  id: string;
  nombre_pieza: string;
  tipo_pieza: string;
  modelos_vinculados: string[];
  vida_util_estimada: number;
  stock_actual: number;
  fecha_ultima_carga: string | null;
  notas: string | null;
  activo: boolean;
}

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

export default function Piezas() {
  const { user, role } = useAuth();
  const { toast } = useToast();
  const [piezas, setPiezas] = useState<PiezaImpresora[]>([]);
  const [historial, setHistorial] = useState<HistorialPieza[]>([]);
  const [configuracion, setConfiguracion] = useState<ConfiguracionPieza[]>([]);
  const [impresoras, setImpresoras] = useState<Impresora[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [cambioDialogOpen, setCambioDialogOpen] = useState(false);
  const [selectedPieza, setSelectedPieza] = useState<PiezaImpresora | null>(null);
  
  // Edit dialogs
  const [editPiezaDialogOpen, setEditPiezaDialogOpen] = useState(false);
  const [editConfigDialogOpen, setEditConfigDialogOpen] = useState(false);
  const [addConfigDialogOpen, setAddConfigDialogOpen] = useState(false);
  const [selectedConfig, setSelectedConfig] = useState<ConfiguracionPieza | null>(null);

  // Form state for new config
  const [newConfigData, setNewConfigData] = useState({
    tipo_pieza: '' as TipoPieza | '',
    nombre_display: '',
    vida_util_default: 10000,
    umbral_advertencia: 70,
    umbral_critico: 90,
  });

  // Form state for new part
  const [printerSearch, setPrinterSearch] = useState('');
  const [formData, setFormData] = useState({
    impresora_id: '',
    tipo_pieza: '' as TipoPieza | '',
    nombre_pieza: '',
    vida_util_estimada: 0,
    contador_instalacion: 0,
    notas: '',
  });

  const filteredImpresoras = impresoras.filter(imp => {
    if (!printerSearch.trim()) return true;
    const q = printerSearch.toLowerCase();
    return imp.nombre.toLowerCase().includes(q) || imp.serie.toLowerCase().includes(q) || imp.modelo.toLowerCase().includes(q);
  });

  // Form state for part change
  const [cambioData, setCambioData] = useState({
    motivo: '',
    observaciones: '',
    nueva_vida_util: 0,
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    
    const [piezasResp, historialResp, configResp, impResp] = await Promise.all([
      supabase
        .from('piezas_impresora')
        .select('*, impresoras(nombre, serie, contador_negro_actual, contador_color_actual)')
        .eq('activo', true)
        .order('fecha_instalacion', { ascending: false }),
      supabase
        .from('historial_piezas')
        .select('*, impresoras(nombre, serie)')
        .order('fecha_cambio', { ascending: false })
        .limit(50),
      supabase
        .from('configuracion_piezas')
        .select('*')
        .order('tipo_pieza'),
      supabase
        .from('impresoras')
        .select('id, nombre, serie, modelo, contador_negro_actual, contador_color_actual, tipo_impresion')
        .eq('estado', 'activa')
        .order('nombre'),
    ]);

    if (piezasResp.data) setPiezas(piezasResp.data as PiezaImpresora[]);
    if (historialResp.data) setHistorial(historialResp.data as HistorialPieza[]);
    if (configResp.data) setConfiguracion(configResp.data as ConfiguracionPieza[]);
    if (impResp.data) setImpresoras(impResp.data);
    
    setLoading(false);
  };

  const resetForm = () => {
    setPrinterSearch('');
    setFormData({
      impresora_id: '',
      tipo_pieza: '',
      nombre_pieza: '',
      vida_util_estimada: 0,
      contador_instalacion: 0,
      notas: '',
    });
  };

  const handleTipoPiezaChange = (tipo: TipoPieza) => {
    const config = configuracion.find(c => c.tipo_pieza === tipo);
    setFormData({
      ...formData,
      tipo_pieza: tipo,
      nombre_pieza: config?.nombre_display || TIPO_PIEZA_LABELS[tipo],
      vida_util_estimada: config?.vida_util_default || 0,
    });
  };

  const handleImpresoraChange = (impId: string) => {
    const imp = impresoras.find(i => i.id === impId);
    if (imp) {
      setFormData({
        ...formData,
        impresora_id: impId,
        contador_instalacion: imp.contador_negro_actual + imp.contador_color_actual,
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !formData.tipo_pieza) return;

    setSaving(true);

    const { error } = await supabase.from('piezas_impresora').insert({
      impresora_id: formData.impresora_id,
      tipo_pieza: formData.tipo_pieza as TipoPieza,
      nombre_pieza: formData.nombre_pieza,
      vida_util_estimada: formData.vida_util_estimada,
      contador_instalacion: formData.contador_instalacion,
      paginas_consumidas: 0,
      notas: formData.notas || null,
      instalado_por: user.id,
    });

    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } else {
      toast({ title: 'Éxito', description: 'Pieza instalada correctamente' });
      setDialogOpen(false);
      resetForm();
      fetchData();
    }

    setSaving(false);
  };

  const handleCambioPieza = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedPieza) return;

    setSaving(true);

    const impresora = impresoras.find(i => i.id === selectedPieza.impresora_id);
    const contadorActual = impresora 
      ? impresora.contador_negro_actual + impresora.contador_color_actual 
      : 0;
    
    const vidaUtilReal = contadorActual - selectedPieza.contador_instalacion;
    const porcentajeVida = (vidaUtilReal / selectedPieza.vida_util_estimada) * 100;

    // 1. Insert into history
    const { error: histError } = await supabase.from('historial_piezas').insert({
      impresora_id: selectedPieza.impresora_id,
      pieza_anterior_id: selectedPieza.id,
      tipo_pieza: selectedPieza.tipo_pieza,
      nombre_pieza: selectedPieza.nombre_pieza,
      contador_cambio: contadorActual,
      vida_util_real: vidaUtilReal,
      vida_util_estimada: selectedPieza.vida_util_estimada,
      porcentaje_vida_consumida: porcentajeVida,
      tecnico_id: user.id,
      motivo: cambioData.motivo || null,
      observaciones: cambioData.observaciones || null,
    });

    if (histError) {
      toast({ variant: 'destructive', title: 'Error', description: histError.message });
      setSaving(false);
      return;
    }

    // 2. Deactivate old part
    await supabase
      .from('piezas_impresora')
      .update({ activo: false })
      .eq('id', selectedPieza.id);

    // 3. Create new part
    const { error: newError } = await supabase.from('piezas_impresora').insert({
      impresora_id: selectedPieza.impresora_id,
      tipo_pieza: selectedPieza.tipo_pieza,
      nombre_pieza: selectedPieza.nombre_pieza,
      vida_util_estimada: cambioData.nueva_vida_util || selectedPieza.vida_util_estimada,
      contador_instalacion: contadorActual,
      paginas_consumidas: 0,
      notas: `Reemplazo de pieza anterior. Motivo: ${cambioData.motivo || 'N/A'}`,
      instalado_por: user.id,
    });

    if (newError) {
      toast({ variant: 'destructive', title: 'Error', description: newError.message });
    } else {
      toast({ title: 'Éxito', description: 'Pieza reemplazada correctamente' });
      setCambioDialogOpen(false);
      setSelectedPieza(null);
      setCambioData({ motivo: '', observaciones: '', nueva_vida_util: 0 });
      fetchData();
    }

    setSaving(false);
  };

  const openCambioDialog = (pieza: PiezaImpresora) => {
    setSelectedPieza(pieza);
    setCambioData({
      motivo: '',
      observaciones: '',
      nueva_vida_util: pieza.vida_util_estimada,
    });
    setCambioDialogOpen(true);
  };

  const openEditPiezaDialog = (pieza: PiezaImpresora) => {
    setSelectedPieza(pieza);
    setEditPiezaDialogOpen(true);
  };

  const openEditConfigDialog = (config: ConfiguracionPieza) => {
    setSelectedConfig(config);
    setEditConfigDialogOpen(true);
  };

  const getDesgasteInfo = (pieza: PiezaImpresora) => {
    const impresora = impresoras.find(i => i.id === pieza.impresora_id);
    const contadorActual = impresora 
      ? impresora.contador_negro_actual + impresora.contador_color_actual 
      : 0;
    const paginasUsadas = contadorActual - pieza.contador_instalacion + pieza.paginas_consumidas;
    const porcentaje = Math.min(100, (paginasUsadas / pieza.vida_util_estimada) * 100);
    const paginasRestantes = Math.max(0, pieza.vida_util_estimada - paginasUsadas);
    
    const config = configuracion.find(c => c.tipo_pieza === pieza.tipo_pieza);
    const umbralAdvertencia = config?.umbral_advertencia || 70;
    const umbralCritico = config?.umbral_critico || 90;

    let status: 'ok' | 'warning' | 'critical' = 'ok';
    if (porcentaje >= umbralCritico) status = 'critical';
    else if (porcentaje >= umbralAdvertencia) status = 'warning';

    return { paginasUsadas, porcentaje, paginasRestantes, status };
  };

  const isAdmin = role === 'admin';

  // Piezas con alertas
  const piezasConAlerta = piezas.filter(p => {
    const { status } = getDesgasteInfo(p);
    return status !== 'ok';
  });

  const exportPiezasCSV = () => {
    const data = piezas.map(p => {
      const pct = p.vida_util_estimada > 0 ? Math.min(100, (p.paginas_consumidas / p.vida_util_estimada) * 100) : 0;
      return {
        Impresora: p.impresoras?.nombre || '',
        Serie: p.impresoras?.serie || '',
        Pieza: p.nombre_pieza,
        Tipo: TIPO_PIEZA_LABELS[p.tipo_pieza],
        VidaUtil: p.vida_util_estimada,
        Consumidas: p.paginas_consumidas,
        PorcentajeUso: `${pct.toFixed(1)}%`,
        FechaInstalacion: new Date(p.fecha_instalacion).toLocaleDateString('es'),
        Notas: p.notas || '',
      };
    });
    if (data.length === 0) return;
    const headers = Object.keys(data[0]).join(',');
    const rows = data.map(row => Object.values(row).map(v => `"${v}"`).join(',')).join('\n');
    const csv = `${headers}\n${rows}`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `piezas_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    toast({ title: 'Exportado', description: 'El archivo CSV ha sido descargado.' });
  };

  const exportPiezasPDF = () => {
    const doc = new jsPDF('landscape');
    const startY = addPDFHeader(doc, 'Gestión de Piezas', `Total: ${piezas.length} piezas activas`);

    const tableData = piezas.map(p => {
      const pct = p.vida_util_estimada > 0 ? Math.min(100, (p.paginas_consumidas / p.vida_util_estimada) * 100) : 0;
      return [
        p.impresoras?.nombre || '-',
        p.impresoras?.serie || '-',
        p.nombre_pieza,
        TIPO_PIEZA_LABELS[p.tipo_pieza],
        p.vida_util_estimada.toLocaleString(),
        p.paginas_consumidas.toLocaleString(),
        `${pct.toFixed(1)}%`,
        new Date(p.fecha_instalacion).toLocaleDateString('es'),
      ];
    });

    autoTable(doc, {
      startY,
      head: [['Impresora', 'Serie', 'Pieza', 'Tipo', 'Vida Útil', 'Consumidas', '% Uso', 'Instalación']],
      body: tableData,
      theme: 'striped',
      headStyles: { fillColor: [59, 130, 246], textColor: 255 },
      styles: { fontSize: 7 },
    });

    addPDFPageNumbers(doc);
    doc.save(`piezas_${new Date().toISOString().split('T')[0]}.pdf`);
    toast({ title: 'PDF Generado', description: 'El listado de piezas ha sido descargado.' });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Wrench className="w-7 h-7 text-primary" />
              </div>
              Gestión de Piezas
            </h1>
            <p className="text-muted-foreground mt-1">
              Control de vida útil y reemplazos de componentes
            </p>
          </div>
          
          <div className="flex gap-2">
            <Button onClick={() => exportPiezasCSV()} variant="outline" className="gap-2">
              <Download className="w-4 h-4" />
              CSV
            </Button>
            <Button onClick={() => exportPiezasPDF()} variant="outline" className="gap-2">
              <FileText className="w-4 h-4" />
              PDF
            </Button>
            <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="w-4 h-4" />
                  Instalar Pieza
                </Button>
              </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Wrench className="w-5 h-5 text-primary" />
                  Registrar Nueva Pieza
                </DialogTitle>
              </DialogHeader>
              
              <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>Impresora *</Label>
                  <Input
                    placeholder="Buscar por nombre, serie o modelo..."
                    value={printerSearch}
                    onChange={e => setPrinterSearch(e.target.value)}
                    className="mb-2"
                  />
                  <Select value={formData.impresora_id} onValueChange={handleImpresoraChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar impresora..." />
                    </SelectTrigger>
                    <SelectContent className="bg-popover">
                      {filteredImpresoras.map(imp => (
                        <SelectItem key={imp.id} value={imp.id}>
                          {imp.nombre} - {imp.modelo} ({imp.serie})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Tipo de Pieza *</Label>
                  <Select value={formData.tipo_pieza} onValueChange={(v) => handleTipoPiezaChange(v as TipoPieza)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar tipo..." />
                    </SelectTrigger>
                    <SelectContent className="bg-popover">
                      {configuracion.filter(c => c.activo).map(c => (
                        <SelectItem key={c.tipo_pieza} value={c.tipo_pieza}>
                          {c.nombre_display}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Nombre de la Pieza</Label>
                  <Input
                    value={formData.nombre_pieza}
                    onChange={e => setFormData({ ...formData, nombre_pieza: e.target.value })}
                    placeholder="Ej: Tóner HP 85A"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Vida Útil (páginas) *</Label>
                    <Input
                      type="number"
                      min={1}
                      value={formData.vida_util_estimada}
                      onChange={e => setFormData({ ...formData, vida_util_estimada: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Contador Instalación</Label>
                    <Input
                      type="number"
                      min={0}
                      value={formData.contador_instalacion}
                      onChange={e => setFormData({ ...formData, contador_instalacion: parseInt(e.target.value) || 0 })}
                      disabled
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Notas</Label>
                  <Textarea
                    value={formData.notas}
                    onChange={e => setFormData({ ...formData, notas: e.target.value })}
                    placeholder="Observaciones adicionales..."
                  />
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={saving || !formData.impresora_id || !formData.tipo_pieza}>
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Instalar Pieza'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
          </div>
        </div>

        {/* Alerts */}
        {piezasConAlerta.length > 0 && (
          <Card className="border-warning/50 bg-warning/5">
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-xl bg-warning/20">
                  <AlertTriangle className="w-6 h-6 text-warning" />
                </div>
                <div>
                  <p className="font-semibold text-warning">
                    {piezasConAlerta.length} pieza(s) requieren atención
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Algunas piezas están próximas a vencer o ya superaron su vida útil estimada.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="hover-lift">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-primary/10">
                  <Wrench className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Piezas Activas</p>
                  <p className="text-2xl font-bold">{piezas.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="hover-lift">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-warning/10">
                  <AlertTriangle className="w-6 h-6 text-warning" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Con Alerta</p>
                  <p className="text-2xl font-bold">{piezasConAlerta.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="hover-lift">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-success/10">
                  <RefreshCw className="w-6 h-6 text-success" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Cambios Realizados</p>
                  <p className="text-2xl font-bold">{historial.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="hover-lift">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-info/10">
                  <Printer className="w-6 h-6 text-info" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Impresoras</p>
                  <p className="text-2xl font-bold">{impresoras.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="piezas" className="space-y-4">
          <TabsList>
            <TabsTrigger value="piezas" className="gap-2">
              <Wrench className="w-4 h-4" />
              Piezas Activas
            </TabsTrigger>
            <TabsTrigger value="historial" className="gap-2">
              <History className="w-4 h-4" />
              Historial de Cambios
            </TabsTrigger>
            {isAdmin && (
              <TabsTrigger value="configuracion" className="gap-2">
                <Settings className="w-4 h-4" />
                Configuración
              </TabsTrigger>
            )}
          </TabsList>

          {/* Piezas Activas Tab */}
          <TabsContent value="piezas">
            <Card>
              <CardHeader>
                <CardTitle>Piezas Instaladas</CardTitle>
                <CardDescription>
                  Control de vida útil y desgaste de componentes
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  </div>
                ) : piezas.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Wrench className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No hay piezas registradas</p>
                    <Button variant="outline" className="mt-4" onClick={() => setDialogOpen(true)}>
                      Instalar primera pieza
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {piezas.map(pieza => {
                      const { paginasUsadas, porcentaje, paginasRestantes, status } = getDesgasteInfo(pieza);
                      
                      return (
                        <Card 
                          key={pieza.id} 
                          className={cn(
                            "border",
                            status === 'critical' && "border-destructive/50 bg-destructive/5",
                            status === 'warning' && "border-warning/50 bg-warning/5"
                          )}
                        >
                          <CardContent className="pt-4">
                            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                              <div className="flex-1 space-y-2">
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline">{TIPO_PIEZA_LABELS[pieza.tipo_pieza]}</Badge>
                                  <span className="font-semibold">{pieza.nombre_pieza}</span>
                                </div>
                                <p className="text-sm text-muted-foreground">
                                  Impresora: <strong>{pieza.impresoras?.nombre}</strong> ({pieza.impresoras?.serie})
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  Instalada: {new Date(pieza.fecha_instalacion).toLocaleDateString('es')}
                                </p>
                              </div>

                              <div className="flex-1">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-sm text-muted-foreground">Vida Útil</span>
                                  <span className={cn(
                                    "text-sm font-semibold",
                                    status === 'critical' && "text-destructive",
                                    status === 'warning' && "text-warning",
                                    status === 'ok' && "text-success"
                                  )}>
                                    {porcentaje.toFixed(1)}%
                                  </span>
                                </div>
                                <Progress 
                                  value={porcentaje} 
                                  className={cn(
                                    "h-3",
                                    status === 'critical' && "[&>div]:bg-destructive",
                                    status === 'warning' && "[&>div]:bg-warning",
                                    status === 'ok' && "[&>div]:bg-success"
                                  )}
                                />
                                <div className="flex justify-between mt-2 text-xs text-muted-foreground">
                                  <span>{paginasUsadas.toLocaleString()} usadas</span>
                                  <span>{paginasRestantes.toLocaleString()} restantes</span>
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                {status !== 'ok' && (
                                  <Badge variant={status === 'critical' ? 'destructive' : 'outline'} className={cn(
                                    status === 'warning' && "border-warning text-warning"
                                  )}>
                                    {status === 'critical' ? 'Vencida' : 'Próxima'}
                                  </Badge>
                                )}
                                <Button 
                                  size="sm" 
                                  variant="ghost"
                                  onClick={() => openEditPiezaDialog(pieza)}
                                  className="gap-1"
                                >
                                  <Pencil className="w-4 h-4" />
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  onClick={() => openCambioDialog(pieza)}
                                  className="gap-2"
                                >
                                  <RefreshCw className="w-4 h-4" />
                                  Cambiar
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Historial Tab */}
          <TabsContent value="historial">
            <Card>
              <CardHeader>
                <CardTitle>Historial de Cambios</CardTitle>
                <CardDescription>
                  Registro de reemplazos de piezas
                </CardDescription>
              </CardHeader>
              <CardContent>
                {historial.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <History className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No hay cambios registrados</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Fecha</TableHead>
                          <TableHead>Impresora</TableHead>
                          <TableHead>Pieza</TableHead>
                          <TableHead>Vida Útil Real</TableHead>
                          <TableHead>% Consumido</TableHead>
                          <TableHead>Motivo</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {historial.map(h => (
                          <TableRow key={h.id}>
                            <TableCell>
                              {new Date(h.fecha_cambio).toLocaleDateString('es')}
                            </TableCell>
                            <TableCell>
                              <div>
                                <span className="font-medium">{h.impresoras?.nombre}</span>
                                <p className="text-xs text-muted-foreground">{h.impresoras?.serie}</p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{TIPO_PIEZA_LABELS[h.tipo_pieza]}</Badge>
                            </TableCell>
                            <TableCell>
                              <div>
                                <span className="font-medium">{(h.vida_util_real || 0).toLocaleString()}</span>
                                <p className="text-xs text-muted-foreground">
                                  de {h.vida_util_estimada.toLocaleString()} est.
                                </p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge 
                                variant="outline"
                                className={cn(
                                  (h.porcentaje_vida_consumida || 0) >= 100 && "border-destructive text-destructive",
                                  (h.porcentaje_vida_consumida || 0) >= 90 && (h.porcentaje_vida_consumida || 0) < 100 && "border-warning text-warning"
                                )}
                              >
                                {(h.porcentaje_vida_consumida || 0).toFixed(1)}%
                              </Badge>
                            </TableCell>
                            <TableCell className="max-w-[200px] truncate">
                              {h.motivo || '-'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Configuración Tab */}
          {isAdmin && (
            <TabsContent value="configuracion">
              <Card>
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <div>
                      <CardTitle>Configuración de Piezas</CardTitle>
                      <CardDescription>
                        Valores predeterminados y umbrales de alerta
                      </CardDescription>
                    </div>
                    <Dialog open={addConfigDialogOpen} onOpenChange={setAddConfigDialogOpen}>
                      <DialogTrigger asChild>
                        <Button size="sm" className="gap-1">
                          <Plus className="w-4 h-4" />
                          Añadir
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                          <DialogTitle className="flex items-center gap-2">
                            <Settings className="w-5 h-5 text-primary" />
                            Nueva Configuración de Pieza
                          </DialogTitle>
                        </DialogHeader>
                        <form onSubmit={async (e) => {
                          e.preventDefault();
                          if (!newConfigData.tipo_pieza || !newConfigData.nombre_display) return;
                          setSaving(true);
                          const { error } = await supabase.from('configuracion_piezas').insert({
                            tipo_pieza: newConfigData.tipo_pieza as TipoPieza,
                            nombre_display: newConfigData.nombre_display,
                            vida_util_default: newConfigData.vida_util_default,
                            umbral_advertencia: newConfigData.umbral_advertencia,
                            umbral_critico: newConfigData.umbral_critico,
                          });
                          if (error) {
                            toast({ variant: 'destructive', title: 'Error', description: error.message });
                          } else {
                            toast({ title: 'Éxito', description: 'Configuración creada' });
                            setAddConfigDialogOpen(false);
                            setNewConfigData({ tipo_pieza: '', nombre_display: '', vida_util_default: 10000, umbral_advertencia: 70, umbral_critico: 90 });
                            fetchData();
                          }
                          setSaving(false);
                        }} className="space-y-4 mt-4">
                          <div className="space-y-2">
                            <Label>Tipo de Pieza *</Label>
                            <Select value={newConfigData.tipo_pieza} onValueChange={(v) => {
                              setNewConfigData({ ...newConfigData, tipo_pieza: v as TipoPieza, nombre_display: TIPO_PIEZA_LABELS[v as TipoPieza] || '' });
                            }}>
                              <SelectTrigger>
                                <SelectValue placeholder="Seleccionar tipo..." />
                              </SelectTrigger>
                              <SelectContent className="bg-popover">
                                {Object.entries(TIPO_PIEZA_LABELS).map(([key, label]) => (
                                  <SelectItem key={key} value={key}>{label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>Nombre para Mostrar *</Label>
                            <Input value={newConfigData.nombre_display} onChange={e => setNewConfigData({ ...newConfigData, nombre_display: e.target.value })} placeholder="Ej: Tóner Negro HP" />
                          </div>
                          <div className="space-y-2">
                            <Label>Vida Útil por Defecto (páginas)</Label>
                            <Input type="number" min={1} value={newConfigData.vida_util_default} onChange={e => setNewConfigData({ ...newConfigData, vida_util_default: parseInt(e.target.value) || 0 })} />
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label>Umbral Advertencia (%)</Label>
                              <Input type="number" min={1} max={100} value={newConfigData.umbral_advertencia} onChange={e => setNewConfigData({ ...newConfigData, umbral_advertencia: parseInt(e.target.value) || 70 })} />
                            </div>
                            <div className="space-y-2">
                              <Label>Umbral Crítico (%)</Label>
                              <Input type="number" min={1} max={100} value={newConfigData.umbral_critico} onChange={e => setNewConfigData({ ...newConfigData, umbral_critico: parseInt(e.target.value) || 90 })} />
                            </div>
                          </div>
                          <div className="flex justify-end gap-2 pt-4">
                            <Button type="button" variant="outline" onClick={() => setAddConfigDialogOpen(false)}>Cancelar</Button>
                            <Button type="submit" disabled={saving}>
                              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Crear Configuración'}
                            </Button>
                          </div>
                        </form>
                      </DialogContent>
                    </Dialog>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Tipo de Pieza</TableHead>
                          <TableHead>Vida Útil Default</TableHead>
                          <TableHead>Umbral Advertencia</TableHead>
                          <TableHead>Umbral Crítico</TableHead>
                          <TableHead>Estado</TableHead>
                          <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {configuracion.map(config => (
                          <TableRow key={config.id}>
                            <TableCell className="font-medium">
                              {config.nombre_display}
                            </TableCell>
                            <TableCell>
                              {config.vida_util_default.toLocaleString()} páginas
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="border-warning text-warning">
                                {config.umbral_advertencia}%
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="border-destructive text-destructive">
                                {config.umbral_critico}%
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {config.activo ? (
                                <Badge className="bg-success/10 text-success border-success/20">Activo</Badge>
                              ) : (
                                <Badge variant="secondary">Inactivo</Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button 
                                size="sm" 
                                variant="ghost"
                                onClick={() => openEditConfigDialog(config)}
                              >
                                <Pencil className="w-4 h-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>

        {/* Dialog for part change */}
        <Dialog open={cambioDialogOpen} onOpenChange={setCambioDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <RefreshCw className="w-5 h-5 text-primary" />
                Cambiar Pieza
              </DialogTitle>
            </DialogHeader>
            
            {selectedPieza && (
              <form onSubmit={handleCambioPieza} className="space-y-4 mt-4">
                <Card className="bg-muted/50">
                  <CardContent className="pt-4 space-y-2">
                    <p className="text-sm">
                      <strong>Pieza:</strong> {selectedPieza.nombre_pieza}
                    </p>
                    <p className="text-sm">
                      <strong>Impresora:</strong> {selectedPieza.impresoras?.nombre}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Esta acción cerrará el ciclo de la pieza actual y creará una nueva.
                    </p>
                  </CardContent>
                </Card>

                <div className="space-y-2">
                  <Label>Motivo del Cambio</Label>
                  <Select value={cambioData.motivo} onValueChange={v => setCambioData({ ...cambioData, motivo: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar motivo..." />
                    </SelectTrigger>
                    <SelectContent className="bg-popover">
                      <SelectItem value="agotado">Agotado / Fin de vida útil</SelectItem>
                      <SelectItem value="defectuoso">Defectuoso / Falla prematura</SelectItem>
                      <SelectItem value="preventivo">Mantenimiento preventivo</SelectItem>
                      <SelectItem value="calidad">Problemas de calidad de impresión</SelectItem>
                      <SelectItem value="otro">Otro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Vida Útil Nueva Pieza (páginas)</Label>
                  <Input
                    type="number"
                    min={1}
                    value={cambioData.nueva_vida_util}
                    onChange={e => setCambioData({ ...cambioData, nueva_vida_util: parseInt(e.target.value) || 0 })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Observaciones</Label>
                  <Textarea
                    value={cambioData.observaciones}
                    onChange={e => setCambioData({ ...cambioData, observaciones: e.target.value })}
                    placeholder="Notas adicionales sobre el cambio..."
                  />
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => setCambioDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={saving}>
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                      <>
                        <CheckCircle2 className="w-4 h-4 mr-2" />
                        Confirmar Cambio
                      </>
                    )}
                  </Button>
                </div>
              </form>
            )}
          </DialogContent>
        </Dialog>

        {/* Edit Pieza Dialog */}
        <EditPiezaDialog
          pieza={selectedPieza}
          open={editPiezaDialogOpen}
          onOpenChange={setEditPiezaDialogOpen}
          onPiezaUpdated={fetchData}
        />

        {/* Edit Configuracion Dialog */}
        <EditConfiguracionDialog
          config={selectedConfig}
          open={editConfigDialogOpen}
          onOpenChange={setEditConfigDialogOpen}
          onConfigUpdated={fetchData}
        />
      </div>
    </DashboardLayout>
  );
}
