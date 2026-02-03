import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, X, ChevronRight, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { usePartsAlerts, TIPO_PIEZA_LABELS } from '@/hooks/usePartsAlerts';

interface PartsAlertBannerProps {
  showDetails?: boolean;
  maxItems?: number;
  className?: string;
}

export function PartsAlertBanner({ 
  showDetails = false, 
  maxItems = 3,
  className 
}: PartsAlertBannerProps) {
  const navigate = useNavigate();
  const { alerts, criticalAlerts, warningAlerts, loading, hasAnyAlerts } = usePartsAlerts();
  const [dismissed, setDismissed] = useState(false);

  if (loading || !hasAnyAlerts || dismissed) {
    return null;
  }

  const hasCritical = criticalAlerts.length > 0;
  const displayAlerts = alerts.slice(0, maxItems);

  return (
    <div 
      className={cn(
        "relative rounded-lg border p-4 mb-4 animate-fade-in",
        hasCritical 
          ? "bg-destructive/10 border-destructive/50" 
          : "bg-warning/10 border-warning/50",
        className
      )}
    >
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-2 right-2 h-6 w-6"
        onClick={() => setDismissed(true)}
      >
        <X className="h-4 w-4" />
      </Button>

      <div className="flex items-start gap-3">
        <div className={cn(
          "p-2 rounded-lg",
          hasCritical ? "bg-destructive/20" : "bg-warning/20"
        )}>
          <AlertTriangle className={cn(
            "h-5 w-5",
            hasCritical ? "text-destructive" : "text-warning"
          )} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className={cn(
              "font-semibold",
              hasCritical ? "text-destructive" : "text-warning"
            )}>
              {hasCritical 
                ? `${criticalAlerts.length} Pieza(s) en Estado Crítico`
                : `${warningAlerts.length} Pieza(s) Requieren Atención`
              }
            </h4>
            {criticalAlerts.length > 0 && warningAlerts.length > 0 && (
              <Badge variant="outline" className="text-xs">
                +{warningAlerts.length} advertencias
              </Badge>
            )}
          </div>

          {showDetails && (
            <div className="space-y-2 mt-3">
              {displayAlerts.map((alert) => (
                <div 
                  key={alert.id}
                  className={cn(
                    "flex items-center justify-between p-2 rounded-md text-sm",
                    alert.status === 'critical' 
                      ? "bg-destructive/10" 
                      : "bg-warning/10"
                  )}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Package className={cn(
                      "h-4 w-4 flex-shrink-0",
                      alert.status === 'critical' ? "text-destructive" : "text-warning"
                    )} />
                    <span className="truncate">
                      {TIPO_PIEZA_LABELS[alert.tipo_pieza] || alert.nombre_pieza}
                    </span>
                    <span className="text-muted-foreground text-xs truncate">
                      ({alert.impresora.nombre})
                    </span>
                  </div>
                  <Badge 
                    variant={alert.status === 'critical' ? 'destructive' : 'secondary'}
                    className="flex-shrink-0 ml-2"
                  >
                    {alert.porcentaje.toFixed(0)}%
                  </Badge>
                </div>
              ))}
              
              {alerts.length > maxItems && (
                <p className="text-xs text-muted-foreground mt-1">
                  y {alerts.length - maxItems} más...
                </p>
              )}
            </div>
          )}

          <Button
            variant="link"
            size="sm"
            className={cn(
              "p-0 h-auto mt-2",
              hasCritical ? "text-destructive" : "text-warning"
            )}
            onClick={() => navigate('/dashboard/piezas')}
          >
            Ver gestión de piezas
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </div>
    </div>
  );
}
