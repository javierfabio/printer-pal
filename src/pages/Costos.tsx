import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DollarSign,
  Loader2,
  Save,
  Printer,
  Building,
  MapPin,
  FileText,
  Download,
  TrendingUp
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { addPDFHeader, addPDFPageNumbers } from '@/lib/pdfHeader';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

const TIPO_PIEZA_LABELS: Record<string, string> = {
  toner_negro: 'Tóner Negro',
  toner_color: 'Tóner Color',
  fusor: 'Fusor',
  unidad_imagen: 'Unidad de Imagen',
  malla: 'Malla / Mesh',
  transfer_belt: 'Transfer Belt',
  rodillo: 'Rodillo',
  otro: 'Otra Pieza',
};

const ALL_TIPOS = Object.keys(TIPO_PIEZA_LABELS);

interface CostoRecord {
  id?: string;
  tipo_pieza: string;
  impresora_id: string | null;
  precio: number;
}

interface ImpresoraBasic {
  id: string;
  nombre: string;
  modelo: string;
  serie: string;
  sector_id: string | null;
  filial_id: string | null;
  contador_negro_actual: number;
  contador_color_actual: number;
  contador_negro_inicial: number;
  contador_color_inicial: number;
}

interface Sector { id: string; nombre: string; }
interface Filial { id: string; nombre: string; }

interface PiezaActiva {
  impresora_id: string;
  tipo_pieza: string;
  vida_util_estimada: number;
  paginas_consumidas: number;
  contador_instalacion: number;
}

export default function Costos() {
  const { role } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [costos, setCostos] = useState<CostoRecord[]>([]);
  const [impresoras, setImpresoras] = useState<ImpresoraBasic[]>([]);
  const [sectores, setSectores] = useState<Sector[]>([]);
  const [filiales, setFiliales] = useState<Filial[]>([]);
  const [piezasActivas, setPiezasActivas] = useState<PiezaActiva[]>([]);

  // Local edits for global prices
  const [globalPrices, setGlobalPrices] = useState<Record<string, number>>({});

  const isAdmin = role === 'admin';

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    const [costResp, impResp, secResp, filResp, piezResp] = await Promise.all([
      supabase.from('costos_consumibles').select('*'),
      supabase.from('impresoras').select('id, nombre, modelo, serie, sector_id, filial_id, contador_negro_actual, contador_color_actual, contador_negro_inicial, contador_color_inicial').eq('estado', 'activa'),
      supabase.from('sectores').select('id, nombre').eq('activo', true),
      supabase.from('filiales').select('id, nombre').eq('activo', true),
      supabase.from('piezas_impresora').select('impresora_id, tipo_pieza, vida_util_estimada, paginas_consumidas, contador_instalacion').eq('activo', true),
    ]);

    const costData = (costResp.data || []) as CostoRecord[];
    setCostos(costData);
    if (impResp.data) setImpresoras(impResp.data as ImpresoraBasic[]);
    if (secResp.data) setSectores(secResp.data);
    if (filResp.data) setFiliales(filResp.data);
    if (piezResp.data) setPiezasActivas(piezResp.data as PiezaActiva[]);

    // Init global prices from existing data
    const gp: Record<string, number> = {};
    costData.filter(c => !c.impresora_id).forEach(c => { gp[c.tipo_pieza] = c.precio; });
    setGlobalPrices(gp);

    setLoading(false);
  };

  const getPrice = (tipoPieza: string, impresoraId?: string): number => {
    if (impresoraId) {
      const specific = costos.find(c => c.tipo_pieza === tipoPieza && c.impresora_id === impresoraId);
      if (specific) return specific.precio;
    }
    return globalPrices[tipoPieza] || 0;
  };

  const saveGlobalPrices = async () => {
    setSaving(true);
    for (const tipo of ALL_TIPOS) {
      const precio = globalPrices[tipo] || 0;
      const existing = costos.find(c => c.tipo_pieza === tipo && !c.impresora_id);
      if (existing) {
        await supabase.from('costos_consumibles').update({ precio }).eq('id', existing.id);
      } else if (precio > 0) {
        await supabase.from('costos_consumibles').insert({ tipo_pieza: tipo, impresora_id: null, precio });
      }
    }
    toast({ title: 'Guardado', description: 'Precios globales actualizados.' });
    await fetchData();
    setSaving(false);
  };

  // Calculate cost per printer
  const printerCosts = impresoras.map(imp => {
    const totalPages = (imp.contador_negro_actual - imp.contador_negro_inicial) + (imp.contador_color_actual - imp.contador_color_inicial);
    const impPiezas = piezasActivas.filter(p => p.impresora_id === imp.id);
    
    let totalCost = 0;
    for (const pieza of impPiezas) {
      const price = getPrice(pieza.tipo_pieza, imp.id);
      // Number of replacements approximated = pages / vida_util
      if (pieza.vida_util_estimada > 0) {
        const replacements = totalPages / pieza.vida_util_estimada;
        totalCost += replacements * price;
      }
    }

    const costPerPage = totalPages > 0 ? totalCost / totalPages : 0;
    
    return {
      ...imp,
      totalPages,
      totalCost,
      costPerPage,
    };
  }).sort((a, b) => b.totalCost - a.totalCost);

  // Cost by sector
  const sectorCosts = sectores.map(s => {
    const sectorPrinters = printerCosts.filter(p => p.sector_id === s.id);
    const total = sectorPrinters.reduce((acc, p) => acc + p.totalCost, 0);
    const pages = sectorPrinters.reduce((acc, p) => acc + p.totalPages, 0);
    return { nombre: s.nombre, total, pages, count: sectorPrinters.length };
  }).filter(s => s.total > 0).sort((a, b) => b.total - a.total);

  // Cost by filial
  const filialCosts = filiales.map(f => {
    const filPrinters = printerCosts.filter(p => p.filial_id === f.id);
    const total = filPrinters.reduce((acc, p) => acc + p.totalCost, 0);
    const pages = filPrinters.reduce((acc, p) => acc + p.totalPages, 0);
    return { nombre: f.nombre, total, pages, count: filPrinters.length };
  }).filter(f => f.total > 0).sort((a, b) => b.total - a.total);

  const totalCostGlobal = printerCosts.reduce((acc, p) => acc + p.totalCost, 0);
  const totalPagesGlobal = printerCosts.reduce((acc, p) => acc + p.totalPages, 0);
  const avgCostPerPage = totalPagesGlobal > 0 ? totalCostGlobal / totalPagesGlobal : 0;

  const getSectorName = (id: string | null) => sectores.find(s => s.id === id)?.nombre || '-';
  const getFilialName = (id: string | null) => filiales.find(f => f.id === id)?.nombre || '-';

  const exportPDF = () => {
    const doc = new jsPDF();
    const startY = addPDFHeader(doc, 'Informe de Costos', `Costo promedio por página: $${avgCostPerPage.toFixed(4)}`);

    autoTable(doc, {
      startY,
      head: [['Impresora', 'Modelo', 'Sector', 'Filial', 'Páginas', 'Costo Total', 'Costo/Pág']],
      body: printerCosts.map(p => [
        p.nombre, p.modelo, getSectorName(p.sector_id), getFilialName(p.filial_id),
        p.totalPages.toLocaleString(), `$${p.totalCost.toFixed(2)}`, `$${p.costPerPage.toFixed(4)}`,
      ]),
      theme: 'striped',
      headStyles: { fillColor: [59, 130, 246], textColor: 255 },
      styles: { fontSize: 7 },
    });

    addPDFPageNumbers(doc);
    doc.save(`costos_${new Date().toISOString().split('T')[0]}.pdf`);
    toast({ title: 'PDF Generado' });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <DollarSign className="w-7 h-7 text-primary" />
              </div>
              Gestión de Costos
            </h1>
            <p className="text-muted-foreground mt-1">
              Registro de precios y cálculo automático de costos por impresora
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={exportPDF} variant="outline" className="gap-2">
              <FileText className="w-4 h-4" />
              PDF
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : (
          <>
            {/* Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="hover-lift">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-primary/10"><DollarSign className="w-6 h-6 text-primary" /></div>
                    <div>
                      <p className="text-sm text-muted-foreground">Costo Total Estimado</p>
                      <p className="text-2xl font-bold">${totalCostGlobal.toFixed(2)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="hover-lift">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-success/10"><TrendingUp className="w-6 h-6 text-success" /></div>
                    <div>
                      <p className="text-sm text-muted-foreground">Costo Promedio/Página</p>
                      <p className="text-2xl font-bold">${avgCostPerPage.toFixed(4)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="hover-lift">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-info/10"><Printer className="w-6 h-6 text-info" /></div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total Páginas</p>
                      <p className="text-2xl font-bold">{totalPagesGlobal.toLocaleString()}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Tabs defaultValue="precios" className="space-y-4">
              <TabsList>
                <TabsTrigger value="precios" className="gap-2"><DollarSign className="w-4 h-4" />Precios Globales</TabsTrigger>
                <TabsTrigger value="impresora" className="gap-2"><Printer className="w-4 h-4" />Por Impresora</TabsTrigger>
                <TabsTrigger value="sector" className="gap-2"><MapPin className="w-4 h-4" />Por Sector</TabsTrigger>
                <TabsTrigger value="filial" className="gap-2"><Building className="w-4 h-4" />Por Filial</TabsTrigger>
              </TabsList>

              {/* Global Prices */}
              <TabsContent value="precios">
                <Card>
                  <CardHeader>
                    <CardTitle>Precios Globales de Consumibles</CardTitle>
                    <CardDescription>Precio por defecto para cada tipo de pieza. Se puede sobrescribir por impresora.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {ALL_TIPOS.map(tipo => (
                        <div key={tipo} className="space-y-2 p-3 rounded-lg bg-muted/50">
                          <Label className="text-sm font-medium">{TIPO_PIEZA_LABELS[tipo]}</Label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                            <Input
                              type="number"
                              min={0}
                              step="0.01"
                              value={globalPrices[tipo] || ''}
                              onChange={e => setGlobalPrices({ ...globalPrices, [tipo]: parseFloat(e.target.value) || 0 })}
                              className="pl-7"
                              placeholder="0.00"
                              disabled={!isAdmin}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                    {isAdmin && (
                      <div className="flex justify-end mt-4">
                        <Button onClick={saveGlobalPrices} disabled={saving} className="gap-2">
                          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                          Guardar Precios
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* By Printer */}
              <TabsContent value="impresora">
                <Card>
                  <CardHeader>
                    <CardTitle>Costo por Impresora</CardTitle>
                    <CardDescription>Cálculo automático basado en consumo y precios de consumibles</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Impresora</TableHead>
                            <TableHead>Modelo</TableHead>
                            <TableHead>Sector</TableHead>
                            <TableHead>Filial</TableHead>
                            <TableHead className="text-right">Páginas</TableHead>
                            <TableHead className="text-right">Costo Total</TableHead>
                            <TableHead className="text-right">Costo/Página</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {printerCosts.map(p => (
                            <TableRow key={p.id}>
                              <TableCell>
                                <div>
                                  <span className="font-medium">{p.nombre}</span>
                                  <p className="text-xs text-muted-foreground">{p.serie}</p>
                                </div>
                              </TableCell>
                              <TableCell>{p.modelo}</TableCell>
                              <TableCell className="text-muted-foreground">{getSectorName(p.sector_id)}</TableCell>
                              <TableCell className="text-muted-foreground">{getFilialName(p.filial_id)}</TableCell>
                              <TableCell className="text-right font-mono">{p.totalPages.toLocaleString()}</TableCell>
                              <TableCell className="text-right font-mono font-semibold">${p.totalCost.toFixed(2)}</TableCell>
                              <TableCell className="text-right font-mono">${p.costPerPage.toFixed(4)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* By Sector */}
              <TabsContent value="sector">
                <Card>
                  <CardHeader>
                    <CardTitle>Costo Acumulado por Sector</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Sector</TableHead>
                            <TableHead className="text-right">Impresoras</TableHead>
                            <TableHead className="text-right">Páginas</TableHead>
                            <TableHead className="text-right">Costo Total</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {sectorCosts.map(s => (
                            <TableRow key={s.nombre}>
                              <TableCell className="font-medium">{s.nombre}</TableCell>
                              <TableCell className="text-right">{s.count}</TableCell>
                              <TableCell className="text-right font-mono">{s.pages.toLocaleString()}</TableCell>
                              <TableCell className="text-right font-mono font-semibold">${s.total.toFixed(2)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* By Filial */}
              <TabsContent value="filial">
                <Card>
                  <CardHeader>
                    <CardTitle>Costo Acumulado por Filial</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Filial</TableHead>
                            <TableHead className="text-right">Impresoras</TableHead>
                            <TableHead className="text-right">Páginas</TableHead>
                            <TableHead className="text-right">Costo Total</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filialCosts.map(f => (
                            <TableRow key={f.nombre}>
                              <TableCell className="font-medium">{f.nombre}</TableCell>
                              <TableCell className="text-right">{f.count}</TableCell>
                              <TableCell className="text-right font-mono">{f.pages.toLocaleString()}</TableCell>
                              <TableCell className="text-right font-mono font-semibold">${f.total.toFixed(2)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
