import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, KeyRound } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const passwordSchema = z.object({
  newPassword: z
    .string()
    .min(6, { message: 'La contraseña debe tener al menos 6 caracteres' })
    .max(72, { message: 'La contraseña no puede exceder 72 caracteres' }),
  confirmPassword: z.string(),
}).refine(data => data.newPassword === data.confirmPassword, {
  message: 'Las contraseñas no coinciden',
  path: ['confirmPassword'],
});

type PasswordFormData = z.infer<typeof passwordSchema>;

interface ChangePasswordDialogProps {
  user: { id: string; email: string; full_name: string | null } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ChangePasswordDialog({ user, open, onOpenChange }: ChangePasswordDialogProps) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const form = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      newPassword: '',
      confirmPassword: '',
    },
  });

  const onSubmit = async (data: PasswordFormData) => {
    if (!user) return;
    setLoading(true);

    try {
      const { data: result, error } = await supabase.functions.invoke('change-password', {
        body: { userId: user.id, newPassword: data.newPassword },
      });

      if (error) throw error;
      if (result?.error) throw new Error(result.error);

      toast({
        title: 'Contraseña actualizada',
        description: `La contraseña de ${user.full_name || user.email} ha sido cambiada exitosamente.`,
      });

      form.reset();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error al cambiar contraseña',
        description: error.message || 'Ocurrió un error inesperado',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) form.reset(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="w-5 h-5" />
            Cambiar Contraseña
          </DialogTitle>
          <DialogDescription>
            Nueva contraseña para <span className="font-medium">{user?.full_name || user?.email}</span>
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="newPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nueva Contraseña</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      placeholder="Mínimo 6 caracteres"
                      {...field}
                      disabled={loading}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Confirmar Contraseña</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      placeholder="Repetir contraseña"
                      {...field}
                      disabled={loading}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

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
                    Cambiando...
                  </>
                ) : (
                  'Cambiar Contraseña'
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
