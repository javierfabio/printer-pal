import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Wrench } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

const MOTIVOS_COMUNES = [
  'Atasco de papel recurrente',
  'Fallo de fusor',
  'Tóner dañado',
  'Unidad de imagen defectuosa',
  'Problema de red / conectividad',
  'Calidad de impresión deficiente',
  'No enciende',
  'Mantenimiento preventivo',
  'Otro',
];

interface RepairOutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  printerId: string;
  printerName: string;
  onSuccess?: () => void;
}

export function RepairOutDialog({ open, onOpenChange, printerId, printerName, onSuccess }: RepairOutDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [fechaSalida, setFechaSalida] = useState(new Date().toISOString().slice(0, 16));
  const [motivoPreset, setMotivoPreset] = useState('');
  const [motivoCustom, setMotivoCustom] = useState('');
  const [tecnico, setTecnico] = useState('');
  const [notas, setNotas] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const motivoFinal = motivoPreset === 'Otro' || !motivoPreset ? motivoCustom : motivoPreset;
    if (!motivoFinal.trim()) {
      toast({ variant: 'destructive', title: 'Falta motivo', description: 'Indicá el motivo de la reparación' });
      return;
    }

    setSaving(true);
    // 1. Insert repair_history
    const { error: repairError } = await supabase.from('repair_history').insert({
      printer_id: printerId,
      fecha_salida: new Date(fechaSalida).toISOString(),
      motivo: motivoFinal,
      tecnico_responsable: tecnico || null,
      notas: notas || null,
      estado: 'en_reparacion',
      registrado_por: user.id,
    });

    if (repairError) {
      toast({ variant: 'destructive', title: 'Error', description: repairError.message });
      setSaving(false);
      return;
    }

    // 2. Update printer status
    const { error: updError } = await supabase
      .from('impresoras')
      .update({ estado: 'en_reparacion', editado_por: user.id })
      .eq('id', printerId);

    if (updError) {
      toast({ variant: 'destructive', title: 'Error', description: updError.message });
    } else {
      toast({ title: 'Impresora enviada a reparación', description: printerName });
      onSuccess?.();
      onOpenChange(false);
      // Reset
      setMotivoPreset(''); setMotivoCustom(''); setTecnico(''); setNotas('');
      setFechaSalida(new Date().toISOString().slice(0, 16));
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wrench className="w-5 h-5 text-warning" />
            Enviar a Reparación
          </DialogTitle>
          <DialogDescription>{printerName}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Fecha de salida *</Label>
            <Input type="datetime-local" value={fechaSalida} onChange={e => setFechaSalida(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label>Motivo común</Label>
            <Select value={motivoPreset} onValueChange={setMotivoPreset}>
              <SelectTrigger><SelectValue placeholder="Seleccionar motivo o escribir uno propio" /></SelectTrigger>
              <SelectContent>
                {MOTIVOS_COMUNES.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{motivoPreset === 'Otro' || !motivoPreset ? 'Detalle del motivo *' : 'Detalle adicional (opcional)'}</Label>
            <Textarea value={motivoCustom} onChange={e => setMotivoCustom(e.target.value)} placeholder="Describí el problema..." rows={2} />
          </div>
          <div className="space-y-2">
            <Label>Técnico o empresa responsable</Label>
            <Input value={tecnico} onChange={e => setTecnico(e.target.value)} placeholder="Ej: Servicio Técnico XYZ" />
          </div>
          <div className="space-y-2">
            <Label>Notas adicionales</Label>
            <Textarea value={notas} onChange={e => setNotas(e.target.value)} rows={2} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Enviar a reparación
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
