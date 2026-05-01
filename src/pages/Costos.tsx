import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import {
  DollarSign,
  Loader2,
  Save,
  Printer,
  Building,
  MapPin,
  FileText,
  TrendingUp,
  Plus,
  Trash2,
  Wrench,
  AlertTriangle,
  Wand2,
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { addPDFHeader, addPDFPageNumbers } from '@/lib/pdfHeader';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { FetchErrorState } from '@/components/ui/fetch-error-state';
import { Badge } from '@/components/ui/badge';
import { ConfirmDeleteButton } from '@/components/ui/ConfirmDeleteButton';

interface PrecioModelo {
  id?: string;
  modelo: string;
  precio_bn: number;
  precio_color: number | null;
  moneda: string;
}

interface CostoReparacion {
  id?: string;
  tipo_reparacion: string;
  costo: number;
  moneda: string;
  descripcion: string | null;
}

interface ImpresoraBasic {
  id: string;
  nombre: string;
  modelo: string;
  serie: string;
  tipo_impresion: string;
  sector_id: string | null;
  filial_id: string | null;
  contador_negro_actual: number;
  contador_color_actual: number;
  contador_negro_inicial: number;
  contador_color_inicial: number;
}

interface Sector { id: string; nombre: string; }
interface Filial { id: string; nombre: string; }

export default function Costos() {
  const { role } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [preciosModelo, setPreciosModelo] = useState<PrecioModelo[]>([]);
  const [reparaciones, setReparaciones] = useState<CostoReparacion[]>([]);
  const [impresoras, setImpresoras] = useState<ImpresoraBasic[]>([]);
  const [sectores, setSectores] = useState<Sector[]>([]);
  const [filiales, setFiliales] = useState<Filial[]>([]);
  const [lecturas, setLecturas] = useState<Array<{ impresora_id: string; contador_negro: number | null; contador_color: number | null; fecha_lectura: string }>>([]);

  // New price form
  const [newModelo, setNewModelo] = useState('');
  const [newPrecioBN, setNewPrecioBN] = useState('');
  const [newPrecioColor, setNewPrecioColor] = useState('');
  const [precioDialogOpen, setPrecioDialogOpen] = useState(false);

  // New repair form
  const [newReparacion, setNewReparacion] = useState('');
  const [newCostoRep, setNewCostoRep] = useState('');
  const [newDescRep, setNewDescRep] = useState('');
  const [repDialogOpen, setRepDialogOpen] = useState(false);

  const isAdmin = role === 'admin';

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    setFetchError(null);
    try {
    const [precResp, repResp, impResp, secResp, filResp, lectResp] = await Promise.all([
      supabase.from('precios_modelo').select('*').order('modelo'),
      supabase.from('costos_reparacion').select('*').order('tipo_reparacion'),
      supabase.from('impresoras').select('id, nombre, modelo, serie, tipo_impresion, sector_id, filial_id, contador_negro_actual, contador_color_actual, contador_negro_inicial, contador_color_inicial').eq('estado', 'activa'),
      supabase.from('sectores').select('id, nombre').eq('activo', true),
      supabase.from('filiales').select('id, nombre').eq('activo', true),
      supabase.from('lecturas_contadores').select('impresora_id, contador_negro, contador_color, fecha_lectura').order('fecha_lectura', { ascending: true }),
    ]);

    if (precResp.data) setPreciosModelo(precResp.data as PrecioModelo[]);
    if (repResp.data) setReparaciones(repResp.data as CostoReparacion[]);
    if (impResp.data) setImpresoras(impResp.data as ImpresoraBasic[]);
    if (secResp.data) setSectores(secResp.data);
    if (filResp.data) setFiliales(filResp.data);
    if (lectResp.data) setLecturas(lectResp.data as any[]);
    } catch (error) {
      console.error('Error al cargar datos:', error);
      setFetchError('No se pudieron cargar los datos. Verificá tu conexión.');
    } finally {
      setLoading(false);
    }
  };

  const getPrecio = (modelo: string) => preciosModelo.find(p => p.modelo === modelo);

  const savePrecioModelo = async () => {
    if (!newModelo.trim()) return;
    setSaving(true);
    const existing = preciosModelo.find(p => p.modelo === newModelo.trim());
    const data = {
      modelo: newModelo.trim(),
      precio_bn: parseFloat(newPrecioBN) || 0,
      precio_color: newPrecioColor ? parseFloat(newPrecioColor) : null,
    };
    if (existing?.id) {
      await supabase.from('precios_modelo').update(data).eq('id', existing.id);
    } else {
      await supabase.from('precios_modelo').insert(data);
    }
    toast({ title: 'Guardado', description: `Precio de ${newModelo} actualizado.` });
    setPrecioDialogOpen(false);
    setNewModelo(''); setNewPrecioBN(''); setNewPrecioColor('');
    await fetchData();
    setSaving(false);
  };

  const deletePrecio = async (id: string) => {
    await supabase.from('precios_modelo').delete().eq('id', id);
    toast({ title: 'Eliminado' });
    fetchData();
  };

  const saveReparacion = async () => {
    if (!newReparacion.trim()) return;
    setSaving(true);
    await supabase.from('costos_reparacion').insert({
      tipo_reparacion: newReparacion.trim(),
      costo: parseFloat(newCostoRep) || 0,
      descripcion: newDescRep.trim() || null,
    });
    toast({ title: 'Guardado', description: 'Costo de reparación registrado.' });
    setRepDialogOpen(false);
    setNewReparacion(''); setNewCostoRep(''); setNewDescRep('');
    await fetchData();
    setSaving(false);
  };

  const deleteReparacion = async (id: string) => {
    await supabase.from('costos_reparacion').delete().eq('id', id);
    toast({ title: 'Eliminado' });
    fetchData();
  };

  // Calculate cost per printer based on model prices
  const getPaginasReales = (impId: string, cnAct: number, ccAct: number, cnIni: number, ccIni: number) => {
    const lecturasImp = lecturas.filter(l => l.impresora_id === impId);
    if (lecturasImp.length >= 2) {
      const primera = lecturasImp[0];
      const ultima = lecturasImp[lecturasImp.length - 1];
      return {
        paginasBN: Math.max(0, (ultima.contador_negro || 0) - (primera.contador_negro || 0)),
        paginasColor: Math.max(0, (ultima.contador_color || 0) - (primera.contador_color || 0)),
        sinLecturas: false,
      };
    }
    return {
      paginasBN: Math.max(0, cnAct - cnIni),
      paginasColor: Math.max(0, ccAct - ccIni),
      sinLecturas: lecturasImp.length < 2,
    };
  };

  const printerCosts = impresoras.map(imp => {
    const { paginasBN, paginasColor, sinLecturas } = getPaginasReales(imp.id, imp.contador_negro_actual, imp.contador_color_actual, imp.contador_negro_inicial, imp.contador_color_inicial);
    const totalPages = paginasBN + paginasColor;
    const precio = getPrecio(imp.modelo);
    const costoBN = paginasBN * (precio?.precio_bn || 0);
    const costoColor = paginasColor * (precio?.precio_color || precio?.precio_bn || 0);
    const totalCost = costoBN + costoColor;
    const costPerPage = totalPages > 0 ? totalCost / totalPages : 0;
    return { ...imp, paginasBN, paginasColor, totalPages, costoBN, costoColor, totalCost, costPerPage, sinLecturas };
  }).sort((a, b) => b.totalCost - a.totalCost);

  const getSectorName = (id: string | null) => sectores.find(s => s.id === id)?.nombre || '-';
  const getFilialName = (id: string | null) => filiales.find(f => f.id === id)?.nombre || '-';

  // Aggregates
  const sectorCosts = sectores.map(s => {
    const sp = printerCosts.filter(p => p.sector_id === s.id);
    return { nombre: s.nombre, total: sp.reduce((a, p) => a + p.totalCost, 0), pages: sp.reduce((a, p) => a + p.totalPages, 0), count: sp.length };
  }).filter(s => s.total > 0).sort((a, b) => b.total - a.total);

  const filialCosts = filiales.map(f => {
    const fp = printerCosts.filter(p => p.filial_id === f.id);
    return { nombre: f.nombre, total: fp.reduce((a, p) => a + p.totalCost, 0), pages: fp.reduce((a, p) => a + p.totalPages, 0), count: fp.length };
  }).filter(f => f.total > 0).sort((a, b) => b.total - a.total);

  const totalCostGlobal = printerCosts.reduce((a, p) => a + p.totalCost, 0);
  const totalPagesGlobal = printerCosts.reduce((a, p) => a + p.totalPages, 0);
  const avgCostPerPage = totalPagesGlobal > 0 ? totalCostGlobal / totalPagesGlobal : 0;

  // Unique models from printers
  const uniqueModelos = [...new Set(impresoras.map(i => i.modelo))].sort();

  // Modelos que tienen impresoras activas pero no tienen precio configurado
  const modelosSinPrecio = uniqueModelos
    .filter(m => !preciosModelo.find(p => p.modelo === m))
    .map(modelo => {
      const imps = impresoras.filter(i => i.modelo === modelo);
      const tipoImpresion = imps[0]?.tipo_impresion || 'monocromatico';
      return { modelo, count: imps.length, tipoImpresion };
    })
    .sort((a, b) => b.count - a.count);

  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardPrices, setWizardPrices] = useState<Record<string, { bn: string; color: string }>>({});

  const openWizard = () => {
    const initial: Record<string, { bn: string; color: string }> = {};
    modelosSinPrecio.forEach(m => { initial[m.modelo] = { bn: '', color: '' }; });
    setWizardPrices(initial);
    setWizardOpen(true);
  };

  const saveWizardPrices = async () => {
    setSaving(true);
    const rows = Object.entries(wizardPrices)
      .filter(([_, v]) => v.bn || v.color)
      .map(([modelo, v]) => ({
        modelo,
        precio_bn: parseFloat(v.bn) || 0,
        precio_color: v.color ? parseFloat(v.color) : null,
      }));
    if (rows.length === 0) {
      toast({ variant: 'destructive', title: 'Nada para guardar', description: 'Completá al menos un precio' });
      setSaving(false);
      return;
    }
    const { error } = await supabase.from('precios_modelo').insert(rows);
    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } else {
      toast({ title: 'Precios guardados', description: `${rows.length} modelo(s) actualizado(s)` });
      setWizardOpen(false);
      await fetchData();
    }
    setSaving(false);
  };

  const exportPDF = () => {
    const doc = new jsPDF('landscape');
    const startY = addPDFHeader(doc, 'Informe de Costos', `Costo promedio por página: ${avgCostPerPage.toFixed(2)} gs`);

    autoTable(doc, {
      startY,
      head: [['Impresora', 'Modelo', 'Filial', 'Sector', 'Págs B/N', 'Págs Color', 'Costo B/N', 'Costo Color', 'Total', 'Costo/Pág']],
      body: printerCosts.map(p => [
        p.nombre, p.modelo, getFilialName(p.filial_id), getSectorName(p.sector_id),
        p.paginasBN.toLocaleString(), p.paginasColor.toLocaleString(),
        `${p.costoBN.toLocaleString()} gs`, `${p.costoColor.toLocaleString()} gs`,
        `${p.totalCost.toLocaleString()} gs`, `${p.costPerPage.toFixed(2)} gs`,
      ]),
      theme: 'striped',
      headStyles: { fillColor: [59, 130, 246], textColor: 255 },
      styles: { fontSize: 7 },
    });

    addPDFPageNumbers(doc);
    doc.save(`costos_${new Date().toISOString().split('T')[0]}.pdf`);
    toast({ title: 'PDF Generado' });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10"><DollarSign className="w-7 h-7 text-primary" /></div>
              Gestión de Costos
            </h1>
            <p className="text-muted-foreground mt-1">Precios por modelo de impresora y costos de reparación</p>
          </div>
          <Button onClick={exportPDF} variant="outline" className="gap-2"><FileText className="w-4 h-4" />PDF</Button>
        </div>

        {fetchError && !loading ? <FetchErrorState error={fetchError} onRetry={fetchData} /> : loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : (
          <>
            {/* Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="hover-lift">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-primary/10"><DollarSign className="w-6 h-6 text-primary" /></div>
                    <div><p className="text-sm text-muted-foreground">Costo Total Estimado</p><p className="text-2xl font-bold">{totalCostGlobal.toLocaleString()} gs</p></div>
                  </div>
                </CardContent>
              </Card>
              <Card className="hover-lift">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-success/10"><TrendingUp className="w-6 h-6 text-success" /></div>
                    <div><p className="text-sm text-muted-foreground">Costo Promedio/Página</p><p className="text-2xl font-bold">{avgCostPerPage.toFixed(2)} gs</p></div>
                  </div>
                </CardContent>
              </Card>
              <Card className="hover-lift">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-info/10"><Printer className="w-6 h-6 text-info" /></div>
                    <div><p className="text-sm text-muted-foreground">Total Páginas</p><p className="text-2xl font-bold">{totalPagesGlobal.toLocaleString()}</p></div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Tabs defaultValue="precios" className="space-y-4">
              <TabsList>
                <TabsTrigger value="precios" className="gap-2"><DollarSign className="w-4 h-4" />Precios por Modelo</TabsTrigger>
                <TabsTrigger value="reparaciones" className="gap-2"><Wrench className="w-4 h-4" />Costos de Reparación</TabsTrigger>
                <TabsTrigger value="impresora" className="gap-2"><Printer className="w-4 h-4" />Por Impresora</TabsTrigger>
                <TabsTrigger value="sector" className="gap-2"><MapPin className="w-4 h-4" />Por Sector</TabsTrigger>
                <TabsTrigger value="filial" className="gap-2"><Building className="w-4 h-4" />Por Filial</TabsTrigger>
              </TabsList>

              {/* Precios por Modelo */}
              <TabsContent value="precios">
                <Card>
                  <CardHeader>
                    <div className="flex justify-between items-center">
                      <div>
                        <CardTitle>Precios por Modelo de Impresora</CardTitle>
                        <CardDescription>Precio por página B/N y Color según el modelo</CardDescription>
                      </div>
                      {isAdmin && (
                        <div className="flex gap-2">
                        {modelosSinPrecio.length > 0 && (
                          <Button size="sm" variant="outline" className="gap-2 border-warning text-warning hover:bg-warning/10" onClick={openWizard}>
                            <Wand2 className="w-4 h-4" />
                            Completar {modelosSinPrecio.length} faltante{modelosSinPrecio.length !== 1 ? 's' : ''}
                          </Button>
                        )}
                        <Dialog open={precioDialogOpen} onOpenChange={setPrecioDialogOpen}>
                          <DialogTrigger asChild>
                            <Button size="sm" className="gap-2"><Plus className="w-4 h-4" />Agregar Precio</Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader><DialogTitle>Agregar Precio por Modelo</DialogTitle></DialogHeader>
                            <div className="space-y-4 mt-4">
                              <div className="space-y-2">
                                <Label>Modelo *</Label>
                                <Input value={newModelo} onChange={e => setNewModelo(e.target.value)} placeholder="Ej: Ricoh IM4000" list="modelos-list" />
                                <datalist id="modelos-list">
                                  {uniqueModelos.map(m => <option key={m} value={m} />)}
                                </datalist>
                              </div>
                              <div className="space-y-2">
                                <Label>Precio por página B/N (gs) *</Label>
                                <Input type="number" min="0" step="0.01" value={newPrecioBN} onChange={e => setNewPrecioBN(e.target.value)} placeholder="Ej: 35" />
                              </div>
                              <div className="space-y-2">
                                <Label>Precio por página Color (gs)</Label>
                                <Input type="number" min="0" step="0.01" value={newPrecioColor} onChange={e => setNewPrecioColor(e.target.value)} placeholder="Dejar vacío si no aplica" />
                              </div>
                              <div className="flex justify-end gap-2">
                                <Button variant="outline" onClick={() => setPrecioDialogOpen(false)}>Cancelar</Button>
                                <Button onClick={savePrecioModelo} disabled={saving}>
                                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4 mr-2" />Guardar</>}
                                </Button>
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>
                        </div>
                      )}
                    </div>
                    {modelosSinPrecio.length > 0 && (
                      <div className="mt-3 p-3 rounded-lg bg-warning/5 border border-warning/30 flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-warning flex-shrink-0 mt-0.5" />
                        <div className="text-sm">
                          <p className="font-medium text-warning">{modelosSinPrecio.length} modelo{modelosSinPrecio.length !== 1 ? 's' : ''} con impresoras activas pero sin precio configurado</p>
                          <p className="text-xs text-muted-foreground mt-0.5">El cálculo de costos no incluye estos modelos. Usá el asistente de arriba para completarlos rápido.</p>
                        </div>
                      </div>
                    )}
                  </CardHeader>
                  <CardContent>
                    {preciosModelo.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <DollarSign className="w-12 h-12 mx-auto mb-2 opacity-30" />
                        <p>No hay precios configurados</p>
                        <p className="text-sm">Agrega precios por modelo para calcular costos</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Modelo</TableHead>
                              <TableHead className="text-right">Precio B/N (gs)</TableHead>
                              <TableHead className="text-right">Precio Color (gs)</TableHead>
                              {isAdmin && <TableHead className="text-right">Acciones</TableHead>}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {preciosModelo.map(p => (
                              <TableRow key={p.id}>
                                <TableCell className="font-medium">{p.modelo}</TableCell>
                                <TableCell className="text-right font-mono">{p.precio_bn.toLocaleString()} gs</TableCell>
                                <TableCell className="text-right font-mono">{p.precio_color !== null ? `${p.precio_color.toLocaleString()} gs` : '—'}</TableCell>
                                {isAdmin && (
                                  <TableCell className="text-right">
                                    <ConfirmDeleteButton
                                      onConfirm={() => deletePrecio(p.id!)}
                                      title="¿Eliminar precio?"
                                      description={`Se eliminará el precio del modelo "${p.modelo}". Los costos calculados quedarán incompletos.`}
                                    />
                                  </TableCell>
                                )}
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Costos de Reparación */}
              <TabsContent value="reparaciones">
                <Card>
                  <CardHeader>
                    <div className="flex justify-between items-center">
                      <div>
                        <CardTitle>Costos de Reparación (Mano de Obra)</CardTitle>
                        <CardDescription>Registro independiente de costos por tipo de reparación</CardDescription>
                      </div>
                      {isAdmin && (
                        <Dialog open={repDialogOpen} onOpenChange={setRepDialogOpen}>
                          <DialogTrigger asChild>
                            <Button size="sm" className="gap-2"><Plus className="w-4 h-4" />Agregar Reparación</Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader><DialogTitle>Agregar Costo de Reparación</DialogTitle></DialogHeader>
                            <div className="space-y-4 mt-4">
                              <div className="space-y-2">
                                <Label>Tipo de Reparación *</Label>
                                <Input value={newReparacion} onChange={e => setNewReparacion(e.target.value)} placeholder="Ej: Cambio de fusor" />
                              </div>
                              <div className="space-y-2">
                                <Label>Costo (gs) *</Label>
                                <Input type="number" min="0" value={newCostoRep} onChange={e => setNewCostoRep(e.target.value)} placeholder="Ej: 150000" />
                              </div>
                              <div className="space-y-2">
                                <Label>Descripción</Label>
                                <Input value={newDescRep} onChange={e => setNewDescRep(e.target.value)} placeholder="Descripción opcional" />
                              </div>
                              <div className="flex justify-end gap-2">
                                <Button variant="outline" onClick={() => setRepDialogOpen(false)}>Cancelar</Button>
                                <Button onClick={saveReparacion} disabled={saving}>
                                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4 mr-2" />Guardar</>}
                                </Button>
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    {reparaciones.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <Wrench className="w-12 h-12 mx-auto mb-2 opacity-30" />
                        <p>No hay costos de reparación registrados</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Tipo de Reparación</TableHead>
                              <TableHead>Descripción</TableHead>
                              <TableHead className="text-right">Costo (gs)</TableHead>
                              {isAdmin && <TableHead className="text-right">Acciones</TableHead>}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {reparaciones.map(r => (
                              <TableRow key={r.id}>
                                <TableCell className="font-medium">{r.tipo_reparacion}</TableCell>
                                <TableCell className="text-muted-foreground">{r.descripcion || '-'}</TableCell>
                                <TableCell className="text-right font-mono font-semibold">{r.costo.toLocaleString()} gs</TableCell>
                                {isAdmin && (
                                  <TableCell className="text-right">
                                    <ConfirmDeleteButton
                                      onConfirm={() => deleteReparacion(r.id!)}
                                      title="¿Eliminar costo de reparación?"
                                      description="Se eliminará este registro de costo. Esta acción no se puede deshacer."
                                    />
                                  </TableCell>
                                )}
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* By Printer */}
              <TabsContent value="impresora">
                <Card>
                  <CardHeader>
                    <CardTitle>Costo por Impresora</CardTitle>
                    <CardDescription>Cálculo basado en lecturas registradas × precio por página del modelo</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Impresora</TableHead>
                            <TableHead>Modelo</TableHead>
                            <TableHead>Filial</TableHead>
                            <TableHead>Sector</TableHead>
                            <TableHead className="text-right">Págs B/N</TableHead>
                            <TableHead className="text-right">Págs Color</TableHead>
                            <TableHead className="text-right">Costo Total</TableHead>
                            <TableHead className="text-right">Costo/Pág</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {printerCosts.map(p => (
                            <TableRow key={p.id}>
                              <TableCell><div><span className="font-medium">{p.nombre}</span><p className="text-xs text-muted-foreground">{p.serie}</p></div></TableCell>
                              <TableCell>{p.modelo}</TableCell>
                              <TableCell className="text-muted-foreground">{getFilialName(p.filial_id)}</TableCell>
                              <TableCell className="text-muted-foreground">{getSectorName(p.sector_id)}</TableCell>
                              <TableCell className="text-right font-mono">
                                {p.sinLecturas ? <Badge variant="outline" className="text-[10px] border-warning text-warning">Sin lecturas</Badge> : p.paginasBN.toLocaleString()}
                              </TableCell>
                              <TableCell className="text-right font-mono">
                                {p.sinLecturas ? <Badge variant="outline" className="text-[10px] border-warning text-warning">Sin lecturas</Badge> : p.paginasColor.toLocaleString()}
                              </TableCell>
                              <TableCell className="text-right font-mono font-semibold">{p.totalCost.toLocaleString()} gs</TableCell>
                              <TableCell className="text-right font-mono">{p.costPerPage.toFixed(2)} gs</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* By Sector */}
              <TabsContent value="sector">
                <Card>
                  <CardHeader><CardTitle>Costo Acumulado por Sector</CardTitle></CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Sector</TableHead>
                            <TableHead className="text-right">Impresoras</TableHead>
                            <TableHead className="text-right">Páginas</TableHead>
                            <TableHead className="text-right">Costo Total</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {sectorCosts.map(s => (
                            <TableRow key={s.nombre}>
                              <TableCell className="font-medium">{s.nombre}</TableCell>
                              <TableCell className="text-right">{s.count}</TableCell>
                              <TableCell className="text-right font-mono">{s.pages.toLocaleString()}</TableCell>
                              <TableCell className="text-right font-mono font-semibold">{s.total.toLocaleString()} gs</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* By Filial */}
              <TabsContent value="filial">
                <Card>
                  <CardHeader><CardTitle>Costo Acumulado por Filial</CardTitle></CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Filial</TableHead>
                            <TableHead className="text-right">Impresoras</TableHead>
                            <TableHead className="text-right">Páginas</TableHead>
                            <TableHead className="text-right">Costo Total</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filialCosts.map(f => (
                            <TableRow key={f.nombre}>
                              <TableCell className="font-medium">{f.nombre}</TableCell>
                              <TableCell className="text-right">{f.count}</TableCell>
                              <TableCell className="text-right font-mono">{f.pages.toLocaleString()}</TableCell>
                              <TableCell className="text-right font-mono font-semibold">{f.total.toLocaleString()} gs</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </>
        )}

        {/* Wizard: completar precios faltantes */}
        <Dialog open={wizardOpen} onOpenChange={setWizardOpen}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><Wand2 className="w-5 h-5 text-warning" />Completar precios faltantes</DialogTitle>
              <CardDescription>Ingresá el precio por página para los modelos con impresoras activas. Dejá vacío los que no quieras configurar ahora.</CardDescription>
            </DialogHeader>
            <div className="space-y-2 mt-4">
              <div className="grid grid-cols-12 gap-2 px-3 py-2 text-xs font-semibold text-muted-foreground border-b">
                <div className="col-span-5">Modelo</div>
                <div className="col-span-2 text-center">Impresoras</div>
                <div className="col-span-2">Tipo</div>
                <div className="col-span-3">Precio (gs)</div>
              </div>
              {modelosSinPrecio.map(m => (
                <div key={m.modelo} className="grid grid-cols-12 gap-2 items-center px-3 py-2 rounded hover:bg-muted/30">
                  <div className="col-span-5 font-medium text-sm">{m.modelo}</div>
                  <div className="col-span-2 text-center text-sm text-muted-foreground">{m.count}</div>
                  <div className="col-span-2 text-xs capitalize">{m.tipoImpresion === 'color' ? '🎨 Color' : '⚫ B/N'}</div>
                  <div className="col-span-3 flex gap-1">
                    <Input type="number" min="0" step="0.01" placeholder="B/N"
                      value={wizardPrices[m.modelo]?.bn || ''}
                      onChange={e => setWizardPrices(p => ({ ...p, [m.modelo]: { ...p[m.modelo], bn: e.target.value } }))}
                      className="h-8 text-xs" />
                    {m.tipoImpresion === 'color' && (
                      <Input type="number" min="0" step="0.01" placeholder="Color"
                        value={wizardPrices[m.modelo]?.color || ''}
                        onChange={e => setWizardPrices(p => ({ ...p, [m.modelo]: { ...p[m.modelo], color: e.target.value } }))}
                        className="h-8 text-xs" />
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2 pt-4 border-t mt-4">
              <Button variant="outline" onClick={() => setWizardOpen(false)}>Cancelar</Button>
              <Button onClick={saveWizardPrices} disabled={saving} className="gap-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Guardar precios
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
