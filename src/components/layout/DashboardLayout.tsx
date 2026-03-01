import { ReactNode, useEffect, useRef, useCallback, useState } from 'react';
import { AppSidebar } from './AppSidebar';
import { PartsAlertBanner } from '@/components/alerts/PartsAlertBanner';
import { usePartsAlerts } from '@/hooks/usePartsAlerts';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useInactivityTimeout } from '@/hooks/useInactivityTimeout';
import { getSystemConfig } from '@/lib/systemConfig';

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const { toast } = useToast();
  const { signOut } = useAuth();
  const { criticalAlerts, warningAlerts, loading } = usePartsAlerts();
  const hasShownToast = useRef(false);
  const [systemConfig] = useState(getSystemConfig());

  const handleInactivityTimeout = useCallback(() => {
    toast({ variant: 'destructive', title: 'Sesión expirada', description: 'Se cerró la sesión por inactividad.' });
    signOut();
  }, [signOut, toast]);

  useInactivityTimeout(handleInactivityTimeout);

  useEffect(() => {
    if (loading || hasShownToast.current) return;
    if (criticalAlerts.length > 0) {
      toast({ variant: 'destructive', title: '⚠️ Alerta Crítica de Piezas', description: `${criticalAlerts.length} pieza(s) requieren reemplazo inmediato.` });
      hasShownToast.current = true;
    } else if (warningAlerts.length > 0) {
      toast({ title: '⚡ Piezas Próximas a Vencer', description: `${warningAlerts.length} pieza(s) superan el umbral de advertencia.` });
      hasShownToast.current = true;
    }
  }, [loading, criticalAlerts.length, warningAlerts.length, toast]);

  return (
    <div className="flex min-h-screen w-full bg-background">
      <AppSidebar />
      <div className="flex-1 flex flex-col overflow-auto">
        <main className="flex-1">
          <div className="container py-6">
            <PartsAlertBanner showDetails={true} maxItems={3} />
            {children}
          </div>
        </main>
        {/* Footer */}
        <footer className="border-t border-border py-3 px-6">
          <div className="container flex flex-col sm:flex-row justify-between items-center gap-1 text-xs text-muted-foreground">
            <span>{systemConfig.copyrightText}</span>
            {systemConfig.developerText && <span>{systemConfig.developerText}</span>}
          </div>
        </footer>
      </div>
    </div>
  );
}
