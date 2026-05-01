export interface WidgetConfig {
  id: string;
  label: string;
  descripcion: string;
  enabled: boolean;
}

export const WIDGET_DEFAULTS: WidgetConfig[] = [
  { id: 'reloj', label: 'Reloj y Fecha', descripcion: 'Hora en tiempo real y fecha actual', enabled: true },
  { id: 'saludo', label: 'Saludo personalizado', descripcion: 'Buenos días/tardes/noches con el nombre', enabled: true },
  { id: 'kpi_paginas', label: 'Total Páginas Impresas', descripcion: 'Card con el total de páginas', enabled: true },
  { id: 'kpi_impresoras', label: 'Impresoras Activas', descripcion: 'Card con impresoras activas', enabled: true },
  { id: 'kpi_piezas', label: 'Piezas con Alerta', descripcion: 'Card con piezas próximas a vencer', enabled: true },
  { id: 'kpi_lecturas', label: 'Lecturas Hoy', descripcion: 'Card con lecturas del día', enabled: true },
  { id: 'kpi_sin_lectura', label: 'Sin Lectura Este Mes', descripcion: 'Card con impresoras sin lectura mensual', enabled: true },
  { id: 'widgets_fecha', label: 'Widgets de Calendario', descripcion: 'Fila de widgets de día, semana y mes', enabled: true },
  { id: 'alerta_modelos', label: 'Alerta Modelos sin Precio', descripcion: 'Banner de modelos sin precio', enabled: true },
  { id: 'piezas_atencion', label: 'Piezas que Requieren Atención', descripcion: 'Sección de piezas críticas', enabled: true },
  { id: 'impresoras_reparacion', label: 'Impresoras en Reparación', descripcion: 'Lista de equipos en reparación', enabled: true },
  { id: 'lecturas_recientes', label: 'Lecturas Recientes', descripcion: 'Tabla de últimas lecturas', enabled: true },
  { id: 'grafico_mensual', label: 'Gráfico Mensual', descripcion: 'Evolución de páginas de los últimos meses', enabled: true },
];

const STORAGE_KEY = 'printcontrol_dashboard_widgets';

export function getWidgetsConfig(): WidgetConfig[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return [...WIDGET_DEFAULTS];
    const parsed: Record<string, boolean> = JSON.parse(saved);
    return WIDGET_DEFAULTS.map(w => ({ ...w, enabled: parsed[w.id] ?? w.enabled }));
  } catch {
    return [...WIDGET_DEFAULTS];
  }
}

export function saveWidgetsConfig(config: WidgetConfig[]): void {
  const map = Object.fromEntries(config.map(w => [w.id, w.enabled]));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}

export function isWidgetEnabled(id: string): boolean {
  return getWidgetsConfig().find(w => w.id === id)?.enabled ?? true;
}