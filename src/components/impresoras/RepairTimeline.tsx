import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, Wrench, CheckCircle, XCircle, Calendar, User, Clock, DollarSign } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface RepairEvent {
  id: string;
  fecha_salida: string;
  fecha_retorno: string | null;
  motivo: string;
  tecnico_responsable: string | null;
  estado: 'en_reparacion' | 'resuelta' | 'irreparable';
  costo_reparacion: number | null;
  moneda: string;
  resultado: string | null;
  notas: string | null;
  registrado_por: string;
  profiles?: { full_name: string | null; email: string };
}

interface RepairTimelineProps {
  printerId: string;
}

export function RepairTimeline({ printerId }: RepairTimelineProps) {
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<RepairEvent[]>([]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data } = await supabase
        .from('repair_history')
        .select('*, profiles:registrado_por(full_name, email)')
        .eq('printer_id', printerId)
        .order('fecha_salida', { ascending: false });
      setEvents((data as any) || []);
      setLoading(false);
    };
    load();
  }, [printerId]);

  const calcDays = (start: string, end: string | null) => {
    const s = new Date(start).getTime();
    const e = end ? new Date(end).getTime() : Date.now();
    return Math.max(0, Math.floor((e - s) / (1000 * 60 * 60 * 24)));
  };

  if (loading) {
    return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  }

  if (events.length === 0) {
    return <p className="text-center text-muted-foreground py-8">Esta impresora no tiene historial de reparaciones</p>;
  }

  return (
    <div className="relative pl-6 space-y-4">
      <div className="absolute left-[11px] top-2 bottom-2 w-0.5 bg-border" />
      {events.map(ev => {
        const days = calcDays(ev.fecha_salida, ev.fecha_retorno);
        const isOpen = ev.estado === 'en_reparacion';
        const isIrreparable = ev.estado === 'irreparable';
        return (
          <div key={ev.id} className="relative">
            <div className={cn(
              'absolute -left-6 top-1 w-5 h-5 rounded-full border-2 border-background flex items-center justify-center',
              isOpen ? 'bg-warning text-warning-foreground animate-pulse' : isIrreparable ? 'bg-destructive text-destructive-foreground' : 'bg-success text-success-foreground'
            )}>
              {isOpen ? <Wrench className="w-3 h-3" /> : isIrreparable ? <XCircle className="w-3 h-3" /> : <CheckCircle className="w-3 h-3" />}
            </div>

            <Card className="ml-2">
              <CardContent className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    {isOpen && <Badge variant="outline" className="bg-warning/10 text-warning border-warning/40 animate-pulse">En reparación</Badge>}
                    {ev.estado === 'resuelta' && <Badge variant="outline" className="bg-success/10 text-success border-success/40">Resuelta</Badge>}
                    {isIrreparable && <Badge variant="destructive">Irreparable</Badge>}
                    <Badge variant="outline" className="gap-1"><Clock className="w-3 h-3" />{days} día{days !== 1 ? 's' : ''}{isOpen && ' (abierto)'}</Badge>
                  </div>
                </div>

                <div className="space-y-1 text-sm">
                  <p className="flex items-center gap-2">
                    <span className="text-destructive">🔴</span>
                    <Calendar className="w-3 h-3 text-muted-foreground" />
                    <span className="text-muted-foreground">Salida:</span>
                    <span className="font-medium">{new Date(ev.fecha_salida).toLocaleString('es', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                  </p>
                  {ev.fecha_retorno && (
                    <p className="flex items-center gap-2">
                      <span className="text-success">🟢</span>
                      <Calendar className="w-3 h-3 text-muted-foreground" />
                      <span className="text-muted-foreground">Retorno:</span>
                      <span className="font-medium">{new Date(ev.fecha_retorno).toLocaleString('es', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                    </p>
                  )}
                </div>

                <div>
                  <p className="text-sm"><span className="text-muted-foreground">Motivo:</span> <span className="font-medium">{ev.motivo}</span></p>
                  {ev.tecnico_responsable && <p className="text-sm"><span className="text-muted-foreground">Técnico:</span> {ev.tecnico_responsable}</p>}
                  {ev.resultado && <p className="text-sm"><span className="text-muted-foreground">Resultado:</span> {ev.resultado}</p>}
                  {ev.costo_reparacion != null && (
                    <p className="text-sm flex items-center gap-1">
                      <DollarSign className="w-3 h-3 text-muted-foreground" />
                      <span className="text-muted-foreground">Costo:</span>
                      <span className="font-medium">{Number(ev.costo_reparacion).toLocaleString('es')} {ev.moneda}</span>
                    </p>
                  )}
                  {ev.notas && <p className="text-xs text-muted-foreground italic mt-1">{ev.notas}</p>}
                </div>

                {ev.profiles && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1 pt-1 border-t">
                    <User className="w-3 h-3" /> Registrado por: {ev.profiles.full_name || ev.profiles.email}
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        );
      })}
    </div>
  );
}
