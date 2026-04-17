import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, CheckCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

interface RepairReturnDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  printerId: string;
  printerName: string;
  onSuccess?: () => void;
}

export function RepairReturnDialog({ open, onOpenChange, printerId, printerName, onSuccess }: RepairReturnDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [openRepairId, setOpenRepairId] = useState<string | null>(null);
  const [openRepairMotivo, setOpenRepairMotivo] = useState<string>('');
  const [fechaRetorno, setFechaRetorno] = useState(new Date().toISOString().slice(0, 16));
  const [estado, setEstado] = useState<'resuelta' | 'irreparable'>('resuelta');
  const [costo, setCosto] = useState('');
  const [resultado, setResultado] = useState('');
  const [notas, setNotas] = useState('');

  useEffect(() => {
    if (open && printerId) {
      // Find latest open repair for this printer
      supabase
        .from('repair_history')
        .select('id, motivo')
        .eq('printer_id', printerId)
        .eq('estado', 'en_reparacion')
        .order('fecha_salida', { ascending: false })
        .limit(1)
        .maybeSingle()
        .then(({ data }) => {
          setOpenRepairId(data?.id || null);
          setOpenRepairMotivo(data?.motivo || '');
        });
    }
  }, [open, printerId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);

    const costoNum = costo ? parseFloat(costo) : null;

    // 1. Update repair_history record (if exists) or create one as standalone
    if (openRepairId) {
      const { error } = await supabase
        .from('repair_history')
        .update({
          fecha_retorno: new Date(fechaRetorno).toISOString(),
          estado,
          costo_reparacion: costoNum,
          resultado: resultado || null,
          notas: notas ? (notas) : null,
        })
        .eq('id', openRepairId);
      if (error) {
        toast({ variant: 'destructive', title: 'Error', description: error.message });
        setSaving(false);
        return;
      }
    } else {
      // No open repair found — create a closed record as fallback
      const { error } = await supabase.from('repair_history').insert({
        printer_id: printerId,
        fecha_salida: new Date(fechaRetorno).toISOString(),
        fecha_retorno: new Date(fechaRetorno).toISOString(),
        motivo: 'Retorno sin registro previo de salida',
        estado,
        costo_reparacion: costoNum,
        resultado: resultado || null,
        notas: notas || null,
        registrado_por: user.id,
      });
      if (error) {
        toast({ variant: 'destructive', title: 'Error', description: error.message });
        setSaving(false);
        return;
      }
    }

    // 2. Insert into costos_reparacion catalog if cost provided
    if (costoNum && costoNum > 0) {
      await supabase.from('costos_reparacion').insert({
        tipo_reparacion: openRepairMotivo || resultado || 'Reparación',
        costo: costoNum,
        moneda: 'gs',
        descripcion: `${printerName} — ${resultado || 'Reparación finalizada'}`,
      });
    }

    // 3. Update printer status
    const newPrinterEstado = estado === 'resuelta' ? 'activa' : 'baja';
    const { error: updError } = await supabase
      .from('impresoras')
      .update({ estado: newPrinterEstado, editado_por: user.id })
      .eq('id', printerId);

    if (updError) {
      toast({ variant: 'destructive', title: 'Error', description: updError.message });
    } else {
      toast({ title: estado === 'resuelta' ? 'Impresora operativa' : 'Impresora dada de baja', description: printerName });
      onSuccess?.();
      onOpenChange(false);
      setCosto(''); setResultado(''); setNotas(''); setEstado('resuelta');
      setFechaRetorno(new Date().toISOString().slice(0, 16));
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-success" />
            Retorno de Reparación
          </DialogTitle>
          <DialogDescription>
            {printerName}
            {openRepairMotivo && <span className="block text-xs mt-1">Motivo original: {openRepairMotivo}</span>}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Fecha de retorno *</Label>
            <Input type="datetime-local" value={fechaRetorno} onChange={e => setFechaRetorno(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label>Resultado *</Label>
            <Select value={estado} onValueChange={v => setEstado(v as 'resuelta' | 'irreparable')}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="resuelta">Reparación exitosa (vuelve a operar)</SelectItem>
                <SelectItem value="irreparable">Irreparable (dar de baja)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Detalle del resultado</Label>
            <Textarea value={resultado} onChange={e => setResultado(e.target.value)} placeholder="Ej: Cambio de fusor + limpieza completa" rows={2} />
          </div>
          <div className="space-y-2">
            <Label>Costo final de reparación (gs)</Label>
            <Input type="number" min="0" step="1000" value={costo} onChange={e => setCosto(e.target.value)} placeholder="0" />
            <p className="text-xs text-muted-foreground">Si se ingresa, se agregará al catálogo de costos de reparación</p>
          </div>
          <div className="space-y-2">
            <Label>Notas adicionales</Label>
            <Textarea value={notas} onChange={e => setNotas(e.target.value)} rows={2} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Confirmar retorno
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
