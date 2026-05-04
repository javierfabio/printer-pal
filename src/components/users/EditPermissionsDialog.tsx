import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, ShieldCheck, ShieldOff } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { DEFAULT_USER_PERMISSIONS } from '@/hooks/usePermissions';

const PERMISSION_GROUPS = [
  { label: 'Impresoras', icon: '🖨️', permissions: [
    { key: 'can_view_impresoras', label: 'Ver impresoras' },
    { key: 'can_create_impresoras', label: 'Agregar impresoras' },
    { key: 'can_edit_impresoras', label: 'Editar impresoras' },
    { key: 'can_delete_impresoras', label: 'Eliminar impresoras' },
  ]},
  { label: 'Lecturas de Contadores', icon: '📋', permissions: [
    { key: 'can_view_lecturas', label: 'Ver lecturas' },
    { key: 'can_create_lecturas', label: 'Registrar lecturas' },
    { key: 'can_delete_lecturas', label: 'Eliminar lecturas' },
  ]},
  { label: 'Gestión de Piezas', icon: '🔧', permissions: [
    { key: 'can_view_piezas', label: 'Ver piezas' },
    { key: 'can_edit_piezas', label: 'Instalar / cambiar piezas' },
  ]},
  { label: 'Costos', icon: '💲', permissions: [
    { key: 'can_view_costos', label: 'Ver costos' },
    { key: 'can_edit_costos', label: 'Editar precios y costos' },
  ]},
  { label: 'Historial y Auditoría', icon: '🕐', permissions: [
    { key: 'can_view_historial', label: 'Ver historial completo' },
  ]},
  { label: 'Informes', icon: '📊', permissions: [
    { key: 'can_view_informes', label: 'Ver informes' },
    { key: 'can_export_informes', label: 'Exportar PDF / CSV' },
  ]},
  { label: 'Configuraciones del Sistema', icon: '⚙️', permissions: [
    { key: 'can_view_config', label: 'Acceder a configuraciones' },
  ]},
];

interface Props {
  user: { id: string; full_name: string | null; email: string } | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function EditPermissionsDialog({ user, open, onOpenChange }: Props) {
  const { toast } = useToast();
  const [perms, setPerms] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user || !open) return;
    setLoading(true);
    supabase.from('user_permissions').select('*').eq('user_id', user.id).maybeSingle()
      .then(({ data }) => {
        if (data) {
          const { id, user_id, created_at, updated_at, ...permData } = data as any;
          setPerms(permData as Record<string, boolean>);
        } else {
          setPerms({ ...DEFAULT_USER_PERMISSIONS } as any);
        }
        setLoading(false);
      });
  }, [user, open]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from('user_permissions').upsert(
      { user_id: user.id, ...perms, updated_at: new Date().toISOString() } as any,
      { onConflict: 'user_id' }
    );
    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } else {
      toast({ title: '✅ Permisos guardados', description: `Permisos de ${user.full_name || user.email} actualizados.` });
      onOpenChange(false);
    }
    setSaving(false);
  };

  const toggleAll = (value: boolean) => {
    setPerms(prev => Object.fromEntries(Object.keys(prev).map(k => [k, value])));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto"
        onInteractOutside={e => e.preventDefault()} onEscapeKeyDown={e => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-primary" />
            Permisos de {user?.full_name || user?.email}
          </DialogTitle>
        </DialogHeader>
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
        ) : (
          <>
            <div className="flex gap-2 py-2 border-b border-border">
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => toggleAll(true)}>
                <ShieldCheck className="w-3.5 h-3.5" />Activar todo
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => toggleAll(false)}>
                <ShieldOff className="w-3.5 h-3.5" />Desactivar todo
              </Button>
              <span className="ml-auto text-xs text-muted-foreground self-center">
                {Object.values(perms).filter(Boolean).length} / {Object.values(perms).length} activos
              </span>
            </div>
            <div className="space-y-4 py-2">
              {PERMISSION_GROUPS.map(group => (
                <div key={group.label}>
                  <div className="flex items-center gap-2 mb-2">
                    <span>{group.icon}</span>
                    <p className="text-sm font-semibold">{group.label}</p>
                  </div>
                  <div className="space-y-0 rounded-xl border border-border overflow-hidden">
                    {group.permissions.map((perm, idx) => (
                      <div key={perm.key}
                        className={`flex items-center justify-between px-4 py-3 ${idx < group.permissions.length - 1 ? 'border-b border-border/50' : ''} ${perms[perm.key] ? 'bg-primary/5' : ''}`}>
                        <div className="flex items-center gap-2">
                          <span className="text-sm">{perm.label}</span>
                          {perms[perm.key] && (
                            <Badge variant="outline" className="text-[10px] py-0 px-1.5 border-success/40 text-success">Activo</Badge>
                          )}
                        </div>
                        <Switch checked={!!perms[perm.key]}
                          onCheckedChange={v => setPerms(prev => ({ ...prev, [perm.key]: v }))} />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving || loading} className="gap-2">
            {saving ? <><Loader2 className="w-4 h-4 animate-spin" />Guardando...</>
              : <><ShieldCheck className="w-4 h-4" />Guardar permisos</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
