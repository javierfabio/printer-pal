import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, Loader2, Search, Package, Pencil, Download, FileText } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { addPDFHeader, addPDFPageNumbers } from '@/lib/pdfHeader';

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

const TIPO_LABELS: Record<string, string> = {
  toner_negro: 'Tóner Negro', toner_color: 'Tóner Color', fusor: 'Fusor',
  unidad_imagen: 'Unidad de Imagen', transfer_belt: 'Transfer Belt',
  rodillo: 'Rodillo', malla: 'Malla', otro: 'Otro',
};

export default function CatalogoPiezas() {
  const { role } = useAuth();
  const { toast } = useToast();
  const [piezas, setPiezas] = useState<PiezaCatalogo[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPieza, setEditingPieza] = useState<PiezaCatalogo | null>(null);
  const [formData, setFormData] = useState({
    nombre_pieza: '', tipo_pieza: 'toner_negro', modelos_vinculados: '',
    vida_util_estimada: 0, stock_actual: 0, notas: '',
  });

  const isAdmin = role === 'admin';

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('piezas_catalogo')
      .select('*')
      .eq('activo', true)
      .order('nombre_pieza');
    if (data) setPiezas(data as PiezaCatalogo[]);
    setLoading(false);
  };

  const filtered = piezas.filter(p => {
    if (!searchTerm) return true;
    const q = searchTerm.toLowerCase();
    return p.nombre_pieza.toLowerCase().includes(q) ||
      p.tipo_pieza.toLowerCase().includes(q) ||
      p.modelos_vinculados.some(m => m.toLowerCase().includes(q));
  });

  const openEdit = (p: PiezaCatalogo) => {
    setEditingPieza(p);
    setFormData({
      nombre_pieza: p.nombre_pieza, tipo_pieza: p.tipo_pieza,
      modelos_vinculados: p.modelos_vinculados.join(', '),
      vida_util_estimada: p.vida_util_estimada, stock_actual: p.stock_actual,
      notas: p.notas || '',
    });
    setDialogOpen(true);
  };

  const openNew = () => {
    setEditingPieza(null);
    setFormData({ nombre_pieza: '', tipo_pieza: 'toner_negro', modelos_vinculados: '', vida_util_estimada: 0, stock_actual: 0, notas: '' });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const modelos = formData.modelos_vinculados.split(',').map(m => m.trim()).filter(Boolean);
    const payload = {
      nombre_pieza: formData.nombre_pieza,
      tipo_pieza: formData.tipo_pieza,
      modelos_vinculados: modelos,
      vida_util_estimada: formData.vida_util_estimada,
      stock_actual: formData.stock_actual,
      notas: formData.notas || null,
      fecha_ultima_carga: formData.stock_actual > 0 ? new Date().toISOString() : editingPieza?.fecha_ultima_carga || null,
    };

    let error;
    if (editingPieza) {
      ({ error } = await supabase.from('piezas_catalogo').update(payload).eq('id', editingPieza.id));
    } else {
      ({ error } = await supabase.from('piezas_catalogo').insert(payload));
    }

    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } else {
      toast({ title: editingPieza ? 'Actualizado' : 'Creado' });
      setDialogOpen(false);
      fetchData();
    }
  };

  const exportPDF = () => {
    const doc = new jsPDF('landscape');
    const startY = addPDFHeader(doc, 'Catálogo de Piezas por Modelo');
    autoTable(doc, {
      startY,
      head: [['Pieza', 'Tipo', 'Modelo(s)', 'Vida Útil', 'Stock', 'Última Carga']],
      body: filtered.map(p => [
        p.nombre_pieza,
        TIPO_LABELS[p.tipo_pieza] || p.tipo_pieza,
        p.modelos_vinculados.join(', '),
        p.vida_util_estimada.toLocaleString(),
        p.stock_actual.toString(),
        p.fecha_ultima_carga ? new Date(p.fecha_ultima_carga).toLocaleDateString('es') : '-',
      ]),
      theme: 'striped',
      headStyles: { fillColor: [59, 130, 246], textColor: 255 },
      styles: { fontSize: 8 },
    });
    addPDFPageNumbers(doc);
    doc.save(`catalogo_piezas_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10"><Package className="w-7 h-7 text-primary" /></div>
              Catálogo de Piezas por Modelo
            </h1>
            <p className="text-muted-foreground mt-1">Piezas vinculadas a modelos de impresoras</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={exportPDF} variant="outline" className="gap-2"><FileText className="w-4 h-4" />PDF</Button>
            {isAdmin && <Button onClick={openNew} className="gap-2"><Plus className="w-4 h-4" />Nueva Pieza</Button>}
          </div>
        </div>

        {/* Search */}
        <Card>
          <CardContent className="pt-6">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Buscar por pieza, tipo o modelo..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-9" />
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardHeader>
            <CardTitle>Piezas del Catálogo</CardTitle>
            <CardDescription>{filtered.length} piezas encontradas</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Package className="w-16 h-16 mx-auto mb-4 opacity-30" />
                <p>No hay piezas en el catálogo</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nombre de Pieza</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Modelo(s) Vinculado(s)</TableHead>
                      <TableHead className="text-right">Vida Útil</TableHead>
                      <TableHead className="text-right">Stock Actual</TableHead>
                      <TableHead>Última Carga</TableHead>
                      {isAdmin && <TableHead className="w-10"></TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map(p => (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">{p.nombre_pieza}</TableCell>
                        <TableCell><Badge variant="outline">{TIPO_LABELS[p.tipo_pieza] || p.tipo_pieza}</Badge></TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {p.modelos_vinculados.map(m => (
                              <Badge key={m} variant="secondary" className="text-xs">{m}</Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono">{p.vida_util_estimada.toLocaleString()}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant={p.stock_actual === 0 ? 'destructive' : p.stock_actual <= 2 ? 'secondary' : 'default'}>
                            {p.stock_actual}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {p.fecha_ultima_carga ? new Date(p.fecha_ultima_carga).toLocaleDateString('es') : '-'}
                        </TableCell>
                        {isAdmin && (
                          <TableCell>
                            <Button variant="ghost" size="icon" onClick={() => openEdit(p)}>
                              <Pencil className="w-4 h-4" />
                            </Button>
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

        {/* Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingPieza ? 'Editar Pieza' : 'Nueva Pieza del Catálogo'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Nombre de Pieza *</Label>
                <Input value={formData.nombre_pieza} onChange={e => setFormData({ ...formData, nombre_pieza: e.target.value })} placeholder="Ej: Tóner Negro" />
              </div>
              <div className="space-y-2">
                <Label>Tipo</Label>
                <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={formData.tipo_pieza} onChange={e => setFormData({ ...formData, tipo_pieza: e.target.value })}>
                  {Object.entries(TIPO_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Modelo(s) Vinculado(s) *</Label>
                <Input value={formData.modelos_vinculados} onChange={e => setFormData({ ...formData, modelos_vinculados: e.target.value })} placeholder="Ej: C5100S, IM400C (separados por coma)" />
                <p className="text-xs text-muted-foreground">Separá los modelos con coma</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Vida Útil Estimada</Label>
                  <Input type="number" value={formData.vida_util_estimada} onChange={e => setFormData({ ...formData, vida_util_estimada: parseInt(e.target.value) || 0 })} />
                </div>
                <div className="space-y-2">
                  <Label>Stock Actual</Label>
                  <Input type="number" value={formData.stock_actual} onChange={e => setFormData({ ...formData, stock_actual: parseInt(e.target.value) || 0 })} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Notas</Label>
                <Input value={formData.notas} onChange={e => setFormData({ ...formData, notas: e.target.value })} placeholder="Opcional" />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                <Button onClick={handleSave} disabled={!formData.nombre_pieza || !formData.modelos_vinculados}>
                  {editingPieza ? 'Guardar Cambios' : 'Crear Pieza'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
