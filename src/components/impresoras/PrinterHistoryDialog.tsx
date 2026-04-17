import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Loader2, History, FileText, Wrench, Calendar, User } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { RepairTimeline } from './RepairTimeline';

interface TimelineEvent {
  id: string;
  date: string;
  type: 'cambio' | 'lectura' | 'pieza';
  title: string;
  detail: string;
  secondary?: string;
  user?: string;
}

interface PrinterHistoryDialogProps {
  printerId: string | null;
  printerName?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PrinterHistoryDialog({ printerId, printerName, open, onOpenChange }: PrinterHistoryDialogProps) {
  const [loading, setLoading] = useState(false);
  const [events, setEvents] = useState<TimelineEvent[]>([]);

  useEffect(() => {
    if (open && printerId) {
      fetchAllHistory(printerId);
    }
  }, [open, printerId]);

  const fetchAllHistory = async (id: string) => {
    setLoading(true);

    const [cambiosResp, lecturasResp, piezasResp] = await Promise.all([
      supabase
        .from('historial_cambios')
        .select('*, profiles:usuario_id(email, full_name)')
        .eq('impresora_id', id)
        .order('created_at', { ascending: false })
        .limit(100),
      supabase
        .from('lecturas_contadores')
        .select('*, profiles:registrado_por(email, full_name)')
        .eq('impresora_id', id)
        .order('fecha_lectura', { ascending: false })
        .limit(100),
      supabase
        .from('historial_piezas')
        .select('*')
        .eq('impresora_id', id)
        .order('fecha_cambio', { ascending: false })
        .limit(100),
    ]);

    const timeline: TimelineEvent[] = [];

    (cambiosResp.data || []).forEach((h: any) => {
      timeline.push({
        id: h.id,
        date: h.created_at,
        type: 'cambio',
        title: `Campo: ${h.campo_modificado}`,
        detail: `${h.valor_anterior || 'N/A'} → ${h.valor_nuevo || 'N/A'}`,
        secondary: h.motivo || undefined,
        user: h.profiles?.full_name || h.profiles?.email || 'Desconocido',
      });
    });

    (lecturasResp.data || []).forEach((l: any) => {
      const parts: string[] = [];
      if (l.contador_negro !== null) parts.push(`Negro: ${l.contador_negro.toLocaleString()}`);
      if (l.contador_color !== null) parts.push(`Color: ${l.contador_color.toLocaleString()}`);
      timeline.push({
        id: l.id,
        date: l.fecha_lectura,
        type: 'lectura',
        title: 'Lectura de contadores',
        detail: parts.join(' / ') || 'Sin datos',
        secondary: l.notas || undefined,
        user: l.profiles?.full_name || l.profiles?.email || 'Desconocido',
      });
    });

    (piezasResp.data || []).forEach((p: any) => {
      timeline.push({
        id: p.id,
        date: p.fecha_cambio,
        type: 'pieza',
        title: `Reemplazo: ${p.nombre_pieza}`,
        detail: `Vida útil: ${p.vida_util_estimada?.toLocaleString()} págs${p.vida_util_real ? ` (real: ${p.vida_util_real.toLocaleString()})` : ''}`,
        secondary: p.motivo || p.observaciones || undefined,
      });
    });

    timeline.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    setEvents(timeline);
    setLoading(false);
  };

  const getTypeIcon = (type: TimelineEvent['type']) => {
    switch (type) {
      case 'cambio': return <History className="w-4 h-4" />;
      case 'lectura': return <FileText className="w-4 h-4" />;
      case 'pieza': return <Wrench className="w-4 h-4" />;
    }
  };

  const getTypeBadge = (type: TimelineEvent['type']) => {
    switch (type) {
      case 'cambio':
        return <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-xs">Cambio</Badge>;
      case 'lectura':
        return <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/20 text-xs">Lectura</Badge>;
      case 'pieza':
        return <Badge variant="outline" className="bg-orange-500/10 text-orange-600 border-orange-500/20 text-xs">Pieza</Badge>;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="w-5 h-5" />
            Historial Completo {printerName ? `— ${printerName}` : ''}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="general" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="general">Cambios, lecturas y piezas</TabsTrigger>
            <TabsTrigger value="reparaciones" className="gap-1"><Wrench className="w-4 h-4" />Reparaciones</TabsTrigger>
          </TabsList>

          <TabsContent value="general">
            <div className="overflow-y-auto max-h-[60vh] pr-1 mt-2">
              {loading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : events.length === 0 ? (
                <p className="text-center text-muted-foreground py-12">No hay registros para esta impresora</p>
              ) : (
                <div className="relative pl-6 space-y-0">
                  <div className="absolute left-[11px] top-2 bottom-2 w-0.5 bg-border" />
                  {events.map((event) => (
                    <div key={event.id} className="relative pb-4">
                      <div className={cn(
                        "absolute -left-6 top-1 w-5 h-5 rounded-full border-2 border-background flex items-center justify-center",
                        event.type === 'cambio' && "bg-primary text-primary-foreground",
                        event.type === 'lectura' && "bg-blue-500 text-white",
                        event.type === 'pieza' && "bg-orange-500 text-white",
                      )}>
                        {getTypeIcon(event.type)}
                      </div>
                      <div className="bg-muted/50 rounded-lg p-3 ml-2">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            {getTypeBadge(event.type)}
                            <span className="font-medium text-sm">{event.title}</span>
                          </div>
                          <span className="text-xs text-muted-foreground whitespace-nowrap flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {new Date(event.date).toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' })}
                            {' '}
                            {new Date(event.date).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className="text-sm">{event.detail}</p>
                        {event.secondary && <p className="text-xs text-muted-foreground mt-1 italic">{event.secondary}</p>}
                        {event.user && (
                          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                            <User className="w-3 h-3" />{event.user}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="reparaciones">
            <div className="overflow-y-auto max-h-[60vh] pr-1 mt-2">
              {printerId && <RepairTimeline printerId={printerId} />}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
