import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BarChart, FileText, Loader2, Plus, Printer, TrendingUp } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

interface Impresora {
  id: string;
  serie: string;
  nombre: string;
  modelo: string;
  tipo_consumo: string;
  tipo_impresion: string;
  contador_negro_actual: number;
  contador_color_actual: number;
}

interface LecturaContador {
  id: string;
  impresora_id: string;
  contador_negro: number | null;
  contador_color: number | null;
  fecha_lectura: string;
  notas: string | null;
  impresoras?: {
    nombre: string;
    serie: string;
  };
}

export default function Informes() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [impresoras, setImpresoras] = useState<Impresora[]>([]);
  const [lecturas, setLecturas] = useState<LecturaContador[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const [selectedPrinter, setSelectedPrinter] = useState<string>('');
  const [contadorNegro, setContadorNegro] = useState<number>(0);
  const [contadorColor, setContadorColor] = useState<number>(0);
  const [notas, setNotas] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    
    const [impResp, lecResp] = await Promise.all([
      supabase.from('impresoras').select('*').eq('estado', 'activa'),
      supabase
        .from('lecturas_contadores')
        .select('*, impresoras(nombre, serie)')
        .order('fecha_lectura', { ascending: false })
        .limit(50),
    ]);

    if (impResp.data) setImpresoras(impResp.data);
    if (lecResp.data) setLecturas(lecResp.data as LecturaContador[]);
    
    setLoading(false);
  };

  const selectedPrinterData = impresoras.find(p => p.id === selectedPrinter);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedPrinter || !user) return;

    const printer = impresoras.find(p => p.id === selectedPrinter);
    if (!printer) return;

    // Validate based on printer type
    if (printer.tipo_impresion === 'monocromatico' && contadorNegro <= printer.contador_negro_actual) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'El contador debe ser mayor al actual',
      });
      return;
    }

    if (printer.tipo_impresion === 'color') {
      if (printer.tipo_consumo === 'toner') {
        // Ricoh/toner: both counters
        if (contadorNegro <= printer.contador_negro_actual || contadorColor <= printer.contador_color_actual) {
          toast({
            variant: 'destructive',
            title: 'Error',
            description: 'Los contadores deben ser mayores a los actuales',
          });
          return;
        }
      } else {
        // Ink/color: only color counter
        if (contadorColor <= printer.contador_color_actual) {
          toast({
            variant: 'destructive',
            title: 'Error',
            description: 'El contador debe ser mayor al actual',
          });
          return;
        }
      }
    }

    setSaving(true);

    // Insert reading
    const { error: lecturaError } = await supabase.from('lecturas_contadores').insert({
      impresora_id: selectedPrinter,
      contador_negro: printer.tipo_impresion === 'monocromatico' || printer.tipo_consumo === 'toner' ? contadorNegro : null,
      contador_color: printer.tipo_impresion === 'color' ? contadorColor : null,
      registrado_por: user.id,
      notas: notas || null,
    });

    if (lecturaError) {
      toast({ variant: 'destructive', title: 'Error', description: lecturaError.message });
      setSaving(false);
      return;
    }

    // Update printer counters
    const updates: any = {};
    if (printer.tipo_impresion === 'monocromatico' || printer.tipo_consumo === 'toner') {
      updates.contador_negro_actual = contadorNegro;
    }
    if (printer.tipo_impresion === 'color') {
      updates.contador_color_actual = contadorColor;
    }

    const { error: updateError } = await supabase
      .from('impresoras')
      .update(updates)
      .eq('id', selectedPrinter);

    if (updateError) {
      toast({ variant: 'destructive', title: 'Error', description: updateError.message });
    } else {
      toast({ title: 'Éxito', description: 'Lectura registrada correctamente' });
      setDialogOpen(false);
      setSelectedPrinter('');
      setContadorNegro(0);
      setContadorColor(0);
      setNotas('');
      fetchData();
    }

    setSaving(false);
  };

  const showBothCounters = selectedPrinterData?.tipo_consumo === 'toner' && selectedPrinterData?.tipo_impresion === 'color';
  const showOnlyColor = selectedPrinterData?.tipo_impresion === 'color' && selectedPrinterData?.tipo_consumo === 'tinta';
  const showOnlyBlack = selectedPrinterData?.tipo_impresion === 'monocromatico';

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold">Informes</h1>
            <p className="text-muted-foreground">Registro de lecturas de contadores</p>
          </div>
          
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="w-4 h-4" />
                Nueva Lectura
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Registrar Lectura de Contador</DialogTitle>
              </DialogHeader>
              
              <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>Impresora *</Label>
                  <Select value={selectedPrinter} onValueChange={setSelectedPrinter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar impresora" />
                    </SelectTrigger>
                    <SelectContent>
                      {impresoras.map(p => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.nombre} ({p.serie})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedPrinterData && (
                  <div className="p-3 bg-muted rounded-lg text-sm">
                    <p><strong>Modelo:</strong> {selectedPrinterData.modelo}</p>
                    <p><strong>Tipo:</strong> {selectedPrinterData.tipo_impresion} / {selectedPrinterData.tipo_consumo}</p>
                    <div className="mt-2 pt-2 border-t border-border">
                      <p className="text-muted-foreground">Contadores actuales:</p>
                      {(showOnlyBlack || showBothCounters) && (
                        <p>Negro: {selectedPrinterData.contador_negro_actual}</p>
                      )}
                      {(showOnlyColor || showBothCounters) && (
                        <p>Color: {selectedPrinterData.contador_color_actual}</p>
                      )}
                    </div>
                  </div>
                )}

                {(showOnlyBlack || showBothCounters) && (
                  <div className="space-y-2">
                    <Label>Contador Negro *</Label>
                    <Input
                      type="number"
                      min={selectedPrinterData?.contador_negro_actual || 0}
                      value={contadorNegro}
                      onChange={e => setContadorNegro(parseInt(e.target.value) || 0)}
                      required
                    />
                  </div>
                )}

                {(showOnlyColor || showBothCounters) && (
                  <div className="space-y-2">
                    <Label>Contador Color *</Label>
                    <Input
                      type="number"
                      min={selectedPrinterData?.contador_color_actual || 0}
                      value={contadorColor}
                      onChange={e => setContadorColor(parseInt(e.target.value) || 0)}
                      required
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Notas (opcional)</Label>
                  <Input
                    value={notas}
                    onChange={e => setNotas(e.target.value)}
                    placeholder="Observaciones..."
                  />
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={saving || !selectedPrinter}>
                    {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Registrar
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-primary/10">
                  <FileText className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Lecturas</p>
                  <p className="text-2xl font-bold">{lecturas.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-success/10">
                  <Printer className="w-6 h-6 text-success" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Impresoras Activas</p>
                  <p className="text-2xl font-bold">{impresoras.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-info/10">
                  <TrendingUp className="w-6 h-6 text-info" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Lecturas Hoy</p>
                  <p className="text-2xl font-bold">
                    {lecturas.filter(l => 
                      new Date(l.fecha_lectura).toDateString() === new Date().toDateString()
                    ).length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Readings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart className="w-5 h-5" />
              Últimas Lecturas
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : lecturas.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No hay lecturas registradas</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Impresora</TableHead>
                      <TableHead>Serie</TableHead>
                      <TableHead>Contador Negro</TableHead>
                      <TableHead>Contador Color</TableHead>
                      <TableHead>Notas</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lecturas.map((lectura) => (
                      <TableRow key={lectura.id}>
                        <TableCell>
                          {new Date(lectura.fecha_lectura).toLocaleDateString('es', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </TableCell>
                        <TableCell className="font-medium">
                          {lectura.impresoras?.nombre || '-'}
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {lectura.impresoras?.serie || '-'}
                        </TableCell>
                        <TableCell>{lectura.contador_negro ?? '-'}</TableCell>
                        <TableCell>{lectura.contador_color ?? '-'}</TableCell>
                        <TableCell className="max-w-[200px] truncate">
                          {lectura.notas || '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
