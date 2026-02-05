import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Loader2, Settings } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface ConfiguracionData {
  id: string;
  tipo_pieza: string;
  nombre_display: string;
  vida_util_default: number;
  umbral_advertencia: number;
  umbral_critico: number;
  activo: boolean;
}

interface EditConfiguracionDialogProps {
  config: ConfiguracionData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfigUpdated: () => void;
}

export function EditConfiguracionDialog({ config, open, onOpenChange, onConfigUpdated }: EditConfiguracionDialogProps) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    nombre_display: '',
    vida_util_default: 0,
    umbral_advertencia: 70,
    umbral_critico: 90,
    activo: true,
  });

  useEffect(() => {
    if (config) {
      setFormData({
        nombre_display: config.nombre_display,
        vida_util_default: config.vida_util_default,
        umbral_advertencia: config.umbral_advertencia,
        umbral_critico: config.umbral_critico,
        activo: config.activo,
      });
    }
  }, [config]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!config) return;
    setLoading(true);

    try {
      const { error } = await supabase
        .from('configuracion_piezas')
        .update({
          nombre_display: formData.nombre_display,
          vida_util_default: formData.vida_util_default,
          umbral_advertencia: formData.umbral_advertencia,
          umbral_critico: formData.umbral_critico,
          activo: formData.activo,
          updated_at: new Date().toISOString(),
        })
        .eq('id', config.id);

      if (error) throw error;

      toast({
        title: 'Configuración actualizada',
        description: 'Los parámetros han sido actualizados correctamente.',
      });

      onOpenChange(false);
      onConfigUpdated();
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
            <Settings className="w-5 h-5" />
            Editar Configuración
          </DialogTitle>
          <DialogDescription>
            Modifica los parámetros de vida útil y alertas
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label>Nombre para Mostrar</Label>
            <Input
              value={formData.nombre_display}
              onChange={e => setFormData({ ...formData, nombre_display: e.target.value })}
              placeholder="Ej: Tóner Negro"
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label>Vida Útil por Defecto (páginas)</Label>
            <Input
              type="number"
              min={1}
              value={formData.vida_util_default}
              onChange={e => setFormData({ ...formData, vida_util_default: parseInt(e.target.value) || 0 })}
              disabled={loading}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Umbral Advertencia (%)</Label>
              <Input
                type="number"
                min={1}
                max={100}
                value={formData.umbral_advertencia}
                onChange={e => setFormData({ ...formData, umbral_advertencia: parseInt(e.target.value) || 70 })}
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label>Umbral Crítico (%)</Label>
              <Input
                type="number"
                min={1}
                max={100}
                value={formData.umbral_critico}
                onChange={e => setFormData({ ...formData, umbral_critico: parseInt(e.target.value) || 90 })}
                disabled={loading}
              />
            </div>
          </div>

          <div className="flex items-center justify-between py-2">
            <Label>Activo</Label>
            <Switch
              checked={formData.activo}
              onCheckedChange={checked => setFormData({ ...formData, activo: checked })}
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
