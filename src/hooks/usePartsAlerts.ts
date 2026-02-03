import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface PartAlert {
  id: string;
  nombre_pieza: string;
  tipo_pieza: string;
  vida_util_estimada: number;
  contador_instalacion: number;
  paginas_consumidas: number;
  porcentaje: number;
  paginasRestantes: number;
  status: 'warning' | 'critical';
  umbralAdvertencia: number;
  umbralCritico: number;
  impresora: {
    id: string;
    nombre: string;
    contador_negro_actual: number;
    contador_color_actual: number;
  };
}

interface ConfiguracionPieza {
  tipo_pieza: string;
  umbral_advertencia: number;
  umbral_critico: number;
  nombre_display: string;
}

export const TIPO_PIEZA_LABELS: Record<string, string> = {
  toner_negro: 'Tóner Negro',
  toner_color: 'Tóner Color',
  fusor: 'Fusor',
  unidad_imagen: 'Unidad de Imagen',
  malla: 'Malla',
  transfer_belt: 'Transfer Belt',
  rodillo: 'Rodillo',
  otro: 'Otra Pieza',
};

export function usePartsAlerts(showToastOnLoad = false) {
  const { toast } = useToast();
  const [alerts, setAlerts] = useState<PartAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastFetch, setLastFetch] = useState<Date | null>(null);

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    
    try {
      // Fetch configuration and parts in parallel
      const [configResp, piezasResp] = await Promise.all([
        supabase.from('configuracion_piezas').select('*').eq('activo', true),
        supabase
          .from('piezas_impresora')
          .select('*, impresoras(id, nombre, contador_negro_actual, contador_color_actual)')
          .eq('activo', true)
      ]);

      if (!configResp.data || !piezasResp.data) {
        setLoading(false);
        return;
      }

      // Create config map by tipo_pieza
      const configMap: Record<string, ConfiguracionPieza> = {};
      configResp.data.forEach((c: ConfiguracionPieza) => {
        configMap[c.tipo_pieza] = c;
      });

      // Process parts and identify alerts
      const alertParts: PartAlert[] = [];

      piezasResp.data.forEach((pieza: any) => {
        if (!pieza.impresoras) return;

        const config = configMap[pieza.tipo_pieza] || {
          umbral_advertencia: 70,
          umbral_critico: 90,
        };

        const contadorActual = 
          (pieza.impresoras.contador_negro_actual || 0) + 
          (pieza.impresoras.contador_color_actual || 0);
        
        const paginasUsadas = contadorActual - pieza.contador_instalacion + pieza.paginas_consumidas;
        const porcentaje = Math.min(100, (paginasUsadas / pieza.vida_util_estimada) * 100);
        const paginasRestantes = Math.max(0, pieza.vida_util_estimada - paginasUsadas);

        // Check if exceeds warning threshold
        if (porcentaje >= config.umbral_advertencia) {
          let status: 'warning' | 'critical' = 'warning';
          if (porcentaje >= config.umbral_critico) {
            status = 'critical';
          }

          alertParts.push({
            id: pieza.id,
            nombre_pieza: pieza.nombre_pieza,
            tipo_pieza: pieza.tipo_pieza,
            vida_util_estimada: pieza.vida_util_estimada,
            contador_instalacion: pieza.contador_instalacion,
            paginas_consumidas: pieza.paginas_consumidas,
            porcentaje,
            paginasRestantes,
            status,
            umbralAdvertencia: config.umbral_advertencia,
            umbralCritico: config.umbral_critico,
            impresora: {
              id: pieza.impresoras.id,
              nombre: pieza.impresoras.nombre,
              contador_negro_actual: pieza.impresoras.contador_negro_actual,
              contador_color_actual: pieza.impresoras.contador_color_actual,
            },
          });
        }
      });

      // Sort by percentage (critical first)
      alertParts.sort((a, b) => b.porcentaje - a.porcentaje);

      setAlerts(alertParts);
      setLastFetch(new Date());

      // Show toast notification if enabled
      if (showToastOnLoad && alertParts.length > 0) {
        const criticalCount = alertParts.filter(a => a.status === 'critical').length;
        const warningCount = alertParts.filter(a => a.status === 'warning').length;

        if (criticalCount > 0) {
          toast({
            variant: 'destructive',
            title: '⚠️ Alerta Crítica de Piezas',
            description: `${criticalCount} pieza(s) requieren reemplazo inmediato.`,
          });
        } else if (warningCount > 0) {
          toast({
            title: '⚡ Piezas Próximas a Vencer',
            description: `${warningCount} pieza(s) superan el umbral de advertencia.`,
          });
        }
      }
    } catch (error) {
      console.error('Error fetching parts alerts:', error);
    } finally {
      setLoading(false);
    }
  }, [showToastOnLoad, toast]);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  const criticalAlerts = alerts.filter(a => a.status === 'critical');
  const warningAlerts = alerts.filter(a => a.status === 'warning');

  return {
    alerts,
    criticalAlerts,
    warningAlerts,
    loading,
    lastFetch,
    refetch: fetchAlerts,
    hasCriticalAlerts: criticalAlerts.length > 0,
    hasWarningAlerts: warningAlerts.length > 0,
    hasAnyAlerts: alerts.length > 0,
    totalAlerts: alerts.length,
  };
}
