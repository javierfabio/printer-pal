import { ReactNode, useCallback, useState } from 'react';
import { AppSidebar } from './AppSidebar';
import { PartsAlertBanner } from '@/components/alerts/PartsAlertBanner';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useInactivityTimeout } from '@/hooks/useInactivityTimeout';
import { getSystemConfig } from '@/lib/systemConfig';
import { PartsAlertsProvider } from '@/contexts/PartsAlertsContext';

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const { toast } = useToast();
  const { signOut } = useAuth();
  const [systemConfig] = useState(getSystemConfig());

  const handleInactivityTimeout = useCallback(() => {
    toast({ variant: 'destructive', title: 'Sesión expirada', description: 'Se cerró la sesión por inactividad.' });
    signOut();
  }, [signOut, toast]);

  useInactivityTimeout(handleInactivityTimeout);

  return (
    <PartsAlertsProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />
        <div className="flex-1 flex flex-col overflow-auto">
          <main className="flex-1">
            <div className="container py-6">
              <PartsAlertBanner showDetails={true} maxItems={3} />
              {children}
            </div>
          </main>
          <footer className="border-t border-border py-3 px-6">
            <div className="container flex flex-col sm:flex-row justify-between items-center gap-1 text-xs text-muted-foreground">
              <span>{systemConfig.copyrightText}</span>
              {systemConfig.developerText && <span>{systemConfig.developerText}</span>}
            </div>
          </footer>
        </div>
      </div>
    </PartsAlertsProvider>
  );
}
