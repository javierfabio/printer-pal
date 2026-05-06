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
import { Plus, ArrowDownToLine, ArrowUpFromLine, Loader2, PackageSearch, Search, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

interface PiezaCatalogo {
  id: string;
  nombre_pieza: string;
  tipo_pieza: string;
  stock_actual: number;
  vida_util_estimada: number;
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
  const [piezaSearch, setPiezaSearch] = useState('');
  const [impresoraSearch, setImpresoraSearch] = useState('');
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

  const piezasFiltradas = piezas
    .filter(p => p.nombre_pieza.toLowerCase().includes(piezaSearch.toLowerCase()))
    .sort((a, b) => a.nombre_pieza.localeCompare(b.nombre_pieza, 'es'));

  const impresorasFiltradas = impresoras
    .filter(i =>
      i.nombre.toLowerCase().includes(impresoraSearch.toLowerCase()) ||
      i.serie.toLowerCase().includes(impresoraSearch.toLowerCase())
    )
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));

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

    // Validar stock suficiente para salidas
    if (tipo === 'salida') {
      const piezaActual = piezas.find(p => p.id === form.pieza_catalogo_id);
      if (piezaActual && piezaActual.stock_actual < form.cantidad) {
        toast({
          variant: 'destructive',
          title: 'Stock insuficiente',
          description: `Solo hay ${piezaActual.stock_actual} unidad(es) en stock de "${piezaActual.nombre_pieza}".`,
        });
        setSaving(false);
        return;
      }
    }

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
      setSaving(false);
      return;
    }

    // Actualizar stock_actual en piezas_catalogo
    const { data: piezaActual } = await supabase
      .from('piezas_catalogo')
      .select('stock_actual')
      .eq('id', form.pieza_catalogo_id)
      .single();

    if (piezaActual) {
      const stockAnterior = piezaActual.stock_actual || 0;
      const nuevoStock = tipo === 'entrada'
        ? stockAnterior + form.cantidad
        : Math.max(0, stockAnterior - form.cantidad);

      const updatePayload: any = { stock_actual: nuevoStock };
      if (tipo === 'entrada') updatePayload.fecha_ultima_carga = new Date().toISOString();

      await supabase
        .from('piezas_catalogo')
        .update(updatePayload)
        .eq('id', form.pieza_catalogo_id);
    }

    // Si es salida con impresora vinculada, instalar/reemplazar pieza en piezas_impresora
    if (tipo === 'salida' && form.impresora_id) {
      const piezaSeleccionada = piezas.find(p => p.id === form.pieza_catalogo_id);
      if (piezaSeleccionada) {
        const { data: impresora } = await supabase
          .from('impresoras')
          .select('contador_negro_actual, contador_color_actual')
          .eq('id', form.impresora_id)
          .single();

        const contadorActual = impresora
          ? (impresora.contador_negro_actual || 0) + (impresora.contador_color_actual || 0)
          : 0;

        // Buscar si ya existe una pieza activa del mismo tipo en esa impresora
        const { data: piezaExistente } = await supabase
          .from('piezas_impresora')
          .select('id, paginas_consumidas, contador_instalacion, vida_util_estimada, nombre_pieza')
          .eq('impresora_id', form.impresora_id)
          .eq('tipo_pieza', piezaSeleccionada.tipo_pieza as any)
          .eq('activo', true)
          .maybeSingle();

        if (piezaExistente) {
          // Reemplazo: registrar historial y resetear la pieza existente
          const vidaUtilReal = Math.max(
            0,
            (contadorActual - (piezaExistente.contador_instalacion || 0)) +
              (piezaExistente.paginas_consumidas || 0)
          );
          const porcentajeVidaConsumida = piezaExistente.vida_util_estimada > 0
            ? Math.min(100, (vidaUtilReal / piezaExistente.vida_util_estimada) * 100)
            : 0;

          await supabase.from('historial_piezas').insert({
            impresora_id: form.impresora_id,
            pieza_anterior_id: piezaExistente.id,
            tipo_pieza: piezaSeleccionada.tipo_pieza as any,
            nombre_pieza: piezaExistente.nombre_pieza,
            contador_cambio: contadorActual,
            vida_util_estimada: piezaExistente.vida_util_estimada || 0,
            vida_util_real: vidaUtilReal,
            porcentaje_vida_consumida: porcentajeVidaConsumida,
            motivo: form.motivo || 'Reemplazo desde stock',
            observaciones: form.notas || null,
            tecnico_id: user.id,
          } as any);

          await supabase
            .from('piezas_impresora')
            .update({
              contador_instalacion: contadorActual,
              paginas_consumidas: 0,
              fecha_instalacion: new Date().toISOString(),
              nombre_pieza: piezaSeleccionada.nombre_pieza,
              vida_util_estimada: piezaSeleccionada.vida_util_estimada || 0,
              notas: form.motivo || form.notas || null,
              activo: true,
            })
            .eq('id', piezaExistente.id);
        } else {
          // Instalación inicial
          const { data: nuevaPieza } = await supabase
            .from('piezas_impresora')
            .insert({
              impresora_id: form.impresora_id,
              tipo_pieza: piezaSeleccionada.tipo_pieza as any,
              nombre_pieza: piezaSeleccionada.nombre_pieza,
              vida_util_estimada: piezaSeleccionada.vida_util_estimada || 0,
              contador_instalacion: contadorActual,
              paginas_consumidas: 0,
              fecha_instalacion: new Date().toISOString(),
              activo: true,
              notas: form.motivo || form.notas || null,
              instalado_por: user.id,
            })
            .select()
            .single();

          if (nuevaPieza) {
            await supabase.from('historial_piezas').insert({
              impresora_id: form.impresora_id,
              pieza_anterior_id: null,
              tipo_pieza: piezaSeleccionada.tipo_pieza as any,
              nombre_pieza: piezaSeleccionada.nombre_pieza,
              contador_cambio: contadorActual,
              vida_util_estimada: piezaSeleccionada.vida_util_estimada || 0,
              vida_util_real: 0,
              porcentaje_vida_consumida: 0,
              motivo: form.motivo || 'Instalación desde stock',
              observaciones: form.notas || null,
              tecnico_id: user.id,
            } as any);
          }
        }
      }
    }

    toast({
      title: '✅ Movimiento registrado',
      description: `${tipo === 'entrada' ? 'Entrada' : 'Salida'} de ${form.cantidad} unidad(es) registrada correctamente.`,
    });
    setOpen(false);
    fetchMovimientos();
    onChange?.();
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

        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setPiezaSearch(''); setImpresoraSearch(''); } }}>
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
                <Select
                  value={form.pieza_catalogo_id}
                  onValueChange={v => setForm({ ...form, pieza_catalogo_id: v })}
                  onOpenChange={() => setPiezaSearch('')}
                >
                  <SelectTrigger><SelectValue placeholder="Seleccionar pieza..." /></SelectTrigger>
                  <SelectContent className="bg-popover p-0">
                    <div className="px-2 pt-2 pb-1 sticky top-0 bg-popover border-b border-border z-10">
                      <div className="flex items-center gap-2 px-2 py-1.5 rounded-md border border-input bg-background">
                        <Search className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                        <input
                          placeholder="Buscar pieza..."
                          value={piezaSearch}
                          onChange={e => setPiezaSearch(e.target.value)}
                          onClick={e => e.stopPropagation()}
                          onKeyDown={e => e.stopPropagation()}
                          className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                          autoComplete="off"
                        />
                        {piezaSearch && (
                          <button type="button" onClick={() => setPiezaSearch('')}
                            className="text-muted-foreground hover:text-foreground">
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="max-h-52 overflow-y-auto py-1">
                      {piezasFiltradas.length === 0 ? (
                        <div className="px-3 py-4 text-sm text-muted-foreground text-center">
                          Sin resultados para "{piezaSearch}"
                        </div>
                      ) : (
                        piezasFiltradas.map(p => (
                          <SelectItem key={p.id} value={p.id}>
                            <div className="flex items-center justify-between gap-3 w-full">
                              <span>{p.nombre_pieza}</span>
                              <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                                p.stock_actual === 0 ? 'bg-destructive/15 text-destructive'
                                : p.stock_actual <= 2 ? 'bg-warning/15 text-warning'
                                : 'bg-success/15 text-success'
                              }`}>
                                Stock: {p.stock_actual}
                              </span>
                            </div>
                          </SelectItem>
                        ))
                      )}
                    </div>
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
                    <Label>
                      Impresora donde se instaló *
                      <span className="text-xs text-muted-foreground ml-1 font-normal">
                        (necesario para actualizar vida útil)
                      </span>
                    </Label>
                    <Select
                      value={form.impresora_id}
                      onValueChange={v => setForm({ ...form, impresora_id: v })}
                      onOpenChange={() => setImpresoraSearch('')}
                    >
                      <SelectTrigger><SelectValue placeholder="Seleccionar impresora..." /></SelectTrigger>
                      <SelectContent className="bg-popover p-0">
                        <div className="px-2 pt-2 pb-1 sticky top-0 bg-popover border-b border-border z-10">
                          <div className="flex items-center gap-2 px-2 py-1.5 rounded-md border border-input bg-background">
                            <Search className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                            <input
                              placeholder="Buscar por nombre o serie..."
                              value={impresoraSearch}
                              onChange={e => setImpresoraSearch(e.target.value)}
                              onClick={e => e.stopPropagation()}
                              onKeyDown={e => e.stopPropagation()}
                              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                              autoComplete="off"
                            />
                            {impresoraSearch && (
                              <button type="button" onClick={() => setImpresoraSearch('')}
                                className="text-muted-foreground hover:text-foreground">
                                <X className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                          {impresoraSearch && (
                            <p className="text-xs text-muted-foreground mt-1 px-1">
                              {impresorasFiltradas.length} resultado{impresorasFiltradas.length !== 1 ? 's' : ''}
                            </p>
                          )}
                        </div>
                        <div className="max-h-52 overflow-y-auto py-1">
                          {impresorasFiltradas.length === 0 ? (
                            <div className="px-3 py-4 text-sm text-muted-foreground text-center">
                              Sin resultados para "{impresoraSearch}"
                            </div>
                          ) : (
                            impresorasFiltradas.map(i => (
                              <SelectItem key={i.id} value={i.id}>
                                <div className="flex flex-col">
                                  <span className="font-medium">{i.nombre}</span>
                                  <span className="text-xs text-muted-foreground font-mono">{i.serie}</span>
                                </div>
                              </SelectItem>
                            ))
                          )}
                        </div>
                      </SelectContent>
                    </Select>
                    {form.impresora_id ? (
                      <p className="text-xs text-success mt-1">
                        ✅ Al confirmar, se actualizará automáticamente la vida útil de la pieza en esa impresora.
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground mt-1">
                        Seleccioná la impresora para que el desgaste quede registrado correctamente.
                      </p>
                    )}
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
                <Button onClick={handleSave} disabled={saving || !form.pieza_catalogo_id || (tipo === 'salida' && !form.impresora_id)}>
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