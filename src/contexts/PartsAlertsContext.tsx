import { createContext, useContext, type ReactNode } from 'react';
import { usePartsAlerts, type PartAlert } from '@/hooks/usePartsAlerts';

interface PartsAlertsContextType {
  alerts: PartAlert[];
  criticalAlerts: PartAlert[];
  warningAlerts: PartAlert[];
  loading: boolean;
  refetch: () => void;
  hasAnyAlerts: boolean;
  hasCriticalAlerts: boolean;
  hasWarningAlerts: boolean;
  totalAlerts: number;
}

const PartsAlertsContext = createContext<PartsAlertsContextType | undefined>(undefined);

export function PartsAlertsProvider({ children }: { children: ReactNode }) {
  const value = usePartsAlerts(true);

  return <PartsAlertsContext.Provider value={value}>{children}</PartsAlertsContext.Provider>;
}

export function usePartsAlertsContext() {
  const context = useContext(PartsAlertsContext);

  if (!context) {
    throw new Error('Debe usarse dentro de PartsAlertsProvider');
  }

  return context;
}