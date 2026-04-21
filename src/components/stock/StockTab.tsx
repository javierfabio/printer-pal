import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, ArrowDownToLine, ArrowUpFromLine, Loader2, PackageSearch } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

interface PiezaCatalogo {
  id: string;
  nombre_pieza: string;
  tipo_pieza: string;
  stock_actual: number;
}

interface Impresora {
  id: string;
  nombre: string;
  serie: string;
}

interface Movimiento {
  id: string;
  pieza_catalogo_id: string;
  tipo_movimiento: 'entrada' | 'salida';
  cantidad: number;
  proveedor: string | null;
  numero_factura: string | null;
  precio_unitario: number | null;
  moneda: string;
  impresora_id: string | null;
  motivo: string | null;
  notas: string | null;
  fecha_movimiento: string;
  piezas_catalogo?: { nombre_pieza: string } | null;
  impresoras?: { nombre: string; serie: string } | null;
}

interface Props {
  piezas: PiezaCatalogo[];
  impresoras: Impresora[];
  onChange?: () => void;
}

export function StockTab({ piezas, impresoras, onChange }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tipo, setTipo] = useState<'entrada' | 'salida'>('entrada');
  const [form, setForm] = useState({
    pieza_catalogo_id: '',
    cantidad: 1,
    proveedor: '',
    numero_factura: '',
    precio_unitario: 0,
    moneda: 'gs',
    impresora_id: '',
    motivo: '',
    notas: '',
  });

  useEffect(() => { fetchMovimientos(); }, []);

  const fetchMovimientos = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('movimientos_stock')
      .select('*, piezas_catalogo(nombre_pieza), impresoras(nombre, serie)')
      .order('fecha_movimiento', { ascending: false })
      .limit(100);
    if (data) setMovimientos(data as any);
    setLoading(false);
  };

  const openDialog = (t: 'entrada' | 'salida') => {
    setTipo(t);
    setForm({
      pieza_catalogo_id: '', cantidad: 1, proveedor: '', numero_factura: '',
      precio_unitario: 0, moneda: 'gs', impresora_id: '', motivo: '', notas: '',
    });
    setOpen(true);
  };

  const handleSave = async () => {
    if (!user || !form.pieza_catalogo_id || form.cantidad <= 0) return;
    setSaving(true);
    const { error } = await supabase.from('movimientos_stock').insert({
      pieza_catalogo_id: form.pieza_catalogo_id,
      tipo_movimiento: tipo,
      cantidad: form.cantidad,
      proveedor: tipo === 'entrada' ? (form.proveedor || null) : null,
      numero_factura: tipo === 'entrada' ? (form.numero_factura || null) : null,
      precio_unitario: tipo === 'entrada' && form.precio_unitario > 0 ? form.precio_unitario : null,
      moneda: form.moneda,
      impresora_id: tipo === 'salida' ? (form.impresora_id || null) : null,
      motivo: form.motivo || null,
      notas: form.notas || null,
      registrado_por: user.id,
    });
    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } else {
      toast({ title: 'Movimiento registrado', description: `${tipo === 'entrada' ? 'Entrada' : 'Salida'} de ${form.cantidad} unidad(es).` });
      setOpen(false);
      fetchMovimientos();
      onChange?.();
    }
    setSaving(false);
  };

  const totales = {
    entradas: movimientos.filter(m => m.tipo_movimiento === 'entrada').reduce((s, m) => s + m.cantidad, 0),
    salidas: movimientos.filter(m => m.tipo_movimiento === 'salida').reduce((s, m) => s + m.cantidad, 0),
    inversion: movimientos
      .filter(m => m.tipo_movimiento === 'entrada' && m.precio_unitario)
      .reduce((s, m) => s + (Number(m.precio_unitario) || 0) * m.cantidad, 0),
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <CardTitle>Movimientos de Stock</CardTitle>
            <CardDescription>Entradas (compras/recepción) y salidas (instalaciones/bajas)</CardDescription>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => openDialog('entrada')} variant="outline" className="gap-2">
              <ArrowDownToLine className="w-4 h-4 text-success" /> Entrada
            </Button>
            <Button onClick={() => openDialog('salida')} className="gap-2">
              <ArrowUpFromLine className="w-4 h-4" /> Salida
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Card className="bg-success/5 border-success/30">
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">Entradas (unidades)</p>
              <p className="text-2xl font-bold text-success">{totales.entradas}</p>
            </CardContent>
          </Card>
          <Card className="bg-destructive/5 border-destructive/30">
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">Salidas (unidades)</p>
              <p className="text-2xl font-bold text-destructive">{totales.salidas}</p>
            </CardContent>
          </Card>
          <Card className="bg-primary/5 border-primary/30">
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">Inversión total</p>
              <p className="text-2xl font-bold text-primary">{totales.inversion.toLocaleString('es')} gs</p>
            </CardContent>
          </Card>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : movimientos.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <PackageSearch className="w-12 h-12 mx-auto mb-3 opacity-40" />
            <p>No hay movimientos registrados todavía</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Pieza</TableHead>
                  <TableHead className="text-right">Cantidad</TableHead>
                  <TableHead>Proveedor / Impresora</TableHead>
                  <TableHead>Factura</TableHead>
                  <TableHead className="text-right">Precio Unit.</TableHead>
                  <TableHead>Motivo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {movimientos.map(m => (
                  <TableRow key={m.id}>
                    <TableCell className="text-xs">{new Date(m.fecha_movimiento).toLocaleDateString('es')}</TableCell>
                    <TableCell>
                      {m.tipo_movimiento === 'entrada' ? (
                        <Badge variant="outline" className="border-success text-success gap-1">
                          <ArrowDownToLine className="w-3 h-3" /> Entrada
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="border-destructive text-destructive gap-1">
                          <ArrowUpFromLine className="w-3 h-3" /> Salida
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="font-medium">{m.piezas_catalogo?.nombre_pieza || '—'}</TableCell>
                    <TableCell className="text-right font-mono">{m.cantidad}</TableCell>
                    <TableCell className="text-sm">
                      {m.tipo_movimiento === 'entrada'
                        ? (m.proveedor || '—')
                        : (m.impresoras ? `${m.impresoras.nombre} (${m.impresoras.serie})` : '—')}
                    </TableCell>
                    <TableCell className="text-sm">{m.numero_factura || '—'}</TableCell>
                    <TableCell className="text-right text-sm">
                      {m.precio_unitario ? `${Number(m.precio_unitario).toLocaleString('es')} ${m.moneda}` : '—'}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[160px] truncate">{m.motivo || '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {tipo === 'entrada' ? <ArrowDownToLine className="w-5 h-5 text-success" /> : <ArrowUpFromLine className="w-5 h-5 text-destructive" />}
                {tipo === 'entrada' ? 'Registrar Entrada de Stock' : 'Registrar Salida de Stock'}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Pieza del catálogo *</Label>
                <Select value={form.pieza_catalogo_id} onValueChange={v => setForm({ ...form, pieza_catalogo_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar pieza..." /></SelectTrigger>
                  <SelectContent className="bg-popover max-h-72">
                    {piezas.map(p => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.nombre_pieza} <span className="text-muted-foreground ml-2">(stock: {p.stock_actual})</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Cantidad *</Label>
                  <Input type="number" min={1} value={form.cantidad}
                    onChange={e => setForm({ ...form, cantidad: Math.max(1, parseInt(e.target.value) || 1) })} />
                </div>
                {tipo === 'entrada' && (
                  <div className="space-y-2">
                    <Label>Precio unitario</Label>
                    <Input type="number" min={0} value={form.precio_unitario}
                      onChange={e => setForm({ ...form, precio_unitario: parseFloat(e.target.value) || 0 })} />
                  </div>
                )}
                {tipo === 'salida' && (
                  <div className="space-y-2">
                    <Label>Impresora destino</Label>
                    <Select value={form.impresora_id} onValueChange={v => setForm({ ...form, impresora_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Opcional..." /></SelectTrigger>
                      <SelectContent className="bg-popover max-h-72">
                        {impresoras.map(i => (
                          <SelectItem key={i.id} value={i.id}>{i.nombre} ({i.serie})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              {tipo === 'entrada' && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Proveedor</Label>
                    <Input value={form.proveedor} onChange={e => setForm({ ...form, proveedor: e.target.value })} placeholder="Nombre del proveedor" />
                  </div>
                  <div className="space-y-2">
                    <Label>N° Factura</Label>
                    <Input value={form.numero_factura} onChange={e => setForm({ ...form, numero_factura: e.target.value })} placeholder="Ej: 001-001-0000123" />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label>Motivo</Label>
                <Input value={form.motivo} onChange={e => setForm({ ...form, motivo: e.target.value })}
                  placeholder={tipo === 'entrada' ? 'Ej: compra mensual, reposición' : 'Ej: instalación, baja por daño'} />
              </div>

              <div className="space-y-2">
                <Label>Notas</Label>
                <Textarea value={form.notas} onChange={e => setForm({ ...form, notas: e.target.value })} rows={2} />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button onClick={handleSave} disabled={saving || !form.pieza_catalogo_id}>
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Registrar'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}