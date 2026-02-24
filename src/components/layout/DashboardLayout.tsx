import { ReactNode, useEffect, useRef, useCallback } from 'react';
import { AppSidebar } from './AppSidebar';
import { PartsAlertBanner } from '@/components/alerts/PartsAlertBanner';
import { usePartsAlerts } from '@/hooks/usePartsAlerts';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useInactivityTimeout } from '@/hooks/useInactivityTimeout';

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const { toast } = useToast();
  const { signOut } = useAuth();
  const { criticalAlerts, warningAlerts, loading } = usePartsAlerts();
  const hasShownToast = useRef(false);

  const handleInactivityTimeout = useCallback(() => {
    toast({
      variant: 'destructive',
      title: 'Sesión expirada',
      description: 'Se cerró la sesión por inactividad.',
    });
    signOut();
  }, [signOut, toast]);

  useInactivityTimeout(handleInactivityTimeout);

  // Show toast notification once on first load
  useEffect(() => {
    if (loading || hasShownToast.current) return;
    
    if (criticalAlerts.length > 0) {
      toast({
        variant: 'destructive',
        title: '⚠️ Alerta Crítica de Piezas',
        description: `${criticalAlerts.length} pieza(s) requieren reemplazo inmediato.`,
      });
      hasShownToast.current = true;
    } else if (warningAlerts.length > 0) {
      toast({
        title: '⚡ Piezas Próximas a Vencer',
        description: `${warningAlerts.length} pieza(s) superan el umbral de advertencia.`,
      });
      hasShownToast.current = true;
    }
  }, [loading, criticalAlerts.length, warningAlerts.length, toast]);

  return (
    <div className="flex min-h-screen w-full bg-background">
      <AppSidebar />
      <main className="flex-1 overflow-auto">
        <div className="container py-6">
          <PartsAlertBanner showDetails={true} maxItems={3} />
          {children}
        </div>
      </main>
    </div>
  );
}
