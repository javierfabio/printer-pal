import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Loader2, Pencil } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface PiezaData {
  id: string;
  nombre_pieza: string;
  vida_util_estimada: number;
  notas: string | null;
}

interface EditPiezaDialogProps {
  pieza: PiezaData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPiezaUpdated: () => void;
}

export function EditPiezaDialog({ pieza, open, onOpenChange, onPiezaUpdated }: EditPiezaDialogProps) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    nombre_pieza: '',
    vida_util_estimada: 0,
    notas: '',
  });

  useEffect(() => {
    if (pieza) {
      setFormData({
        nombre_pieza: pieza.nombre_pieza,
        vida_util_estimada: pieza.vida_util_estimada,
        notas: pieza.notas || '',
      });
    }
  }, [pieza]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pieza) return;
    setLoading(true);

    try {
      const { error } = await supabase
        .from('piezas_impresora')
        .update({
          nombre_pieza: formData.nombre_pieza,
          vida_util_estimada: formData.vida_util_estimada,
          notas: formData.notas || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', pieza.id);

      if (error) throw error;

      toast({
        title: 'Pieza actualizada',
        description: 'Los datos de la pieza han sido actualizados correctamente.',
      });

      onOpenChange(false);
      onPiezaUpdated();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error al actualizar',
        description: error.message || 'Ocurrió un error inesperado',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="w-5 h-5" />
            Editar Pieza
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label>Nombre de la Pieza</Label>
            <Input
              value={formData.nombre_pieza}
              onChange={e => setFormData({ ...formData, nombre_pieza: e.target.value })}
              placeholder="Ej: Tóner HP 85A"
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label>Vida Útil Estimada (páginas)</Label>
            <Input
              type="number"
              min={1}
              value={formData.vida_util_estimada}
              onChange={e => setFormData({ ...formData, vida_util_estimada: parseInt(e.target.value) || 0 })}
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label>Notas</Label>
            <Textarea
              value={formData.notas}
              onChange={e => setFormData({ ...formData, notas: e.target.value })}
              placeholder="Observaciones adicionales..."
              disabled={loading}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Guardando...
                </>
              ) : (
                'Guardar Cambios'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
