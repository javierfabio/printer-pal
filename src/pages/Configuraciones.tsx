import { useEffect, useState, useRef } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Building, Loader2, MapPin, Plus, Shield, ImageIcon, Trash2, Upload, Clock, FileText, Settings, Code, DatabaseBackup, LayoutDashboard } from 'lucide-react';
import { ConfirmDeleteButton } from '@/components/ui/ConfirmDeleteButton';
import { getWidgetsConfig, saveWidgetsConfig, WIDGET_DEFAULTS, type WidgetConfig } from '@/lib/dashboardWidgets';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import JSZip from 'jszip';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { getCorporateLogo, saveCorporateLogo, removeCorporateLogo, getCorporateName, saveCorporateName } from '@/lib/pdfHeader';
import { getInactivityTimeout, saveInactivityTimeout } from '@/hooks/useInactivityTimeout';
import { getSystemConfig, saveSystemConfig, type SystemConfig } from '@/lib/systemConfig';
import { FetchErrorState } from '@/components/ui/fetch-error-state';

interface Sector { id: string; nombre: string; descripcion: string | null; activo: boolean; }
interface Filial { id: string; nombre: string; direccion: string | null; activo: boolean; }

const REPORT_CONFIG_KEY = 'report_config';

interface ReportConfig {
  showSignature: boolean;
  responsibleName: string;
  headerText: string;
  footerText: string;
  maxImageSizeKB: number;
  defaultFormat: 'pdf' | 'csv';
}

function getReportConfig(): ReportConfig {
  const raw = localStorage.getItem(REPORT_CONFIG_KEY);
  if (raw) { try { return JSON.parse(raw); } catch { /* fallthrough */ } }
  return { showSignature: false, responsibleName: '', headerText: '', footerText: '', maxImageSizeKB: 500, defaultFormat: 'pdf' };
}

function saveReportConfig(config: ReportConfig) { localStorage.setItem(REPORT_CONFIG_KEY, JSON.stringify(config)); }

export { getReportConfig, saveReportConfig };
export type { ReportConfig };

export default function Configuraciones() {
  const { role } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [sectores, setSectores] = useState<Sector[]>([]);
  const [filiales, setFiliales] = useState<Filial[]>([]);
  const [sectorDialogOpen, setSectorDialogOpen] = useState(false);
  const [filialDialogOpen, setFilialDialogOpen] = useState(false);
  const [newSectorName, setNewSectorName] = useState('');
  const [newSectorDesc, setNewSectorDesc] = useState('');
  const [newFilialName, setNewFilialName] = useState('');
  const [newFilialDir, setNewFilialDir] = useState('');

  const isAdmin = role === 'admin';
  const [logoPreview, setLogoPreview] = useState<string | null>(getCorporateLogo());
  const [companyName, setCompanyName] = useState(getCorporateName() || '');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [inactivityMinutes, setInactivityMinutes] = useState(getInactivityTimeout());
  const [reportConfig, setReportConfig] = useState<ReportConfig>(getReportConfig());
  const [systemConfig, setSystemConfig] = useState<SystemConfig>(getSystemConfig());
  const [exportingBackup, setExportingBackup] = useState(false);
  const [widgetsConfig, setWidgetsConfig] = useState<WidgetConfig[]>(getWidgetsConfig());

  const exportDatabaseBackup = async () => {
    setExportingBackup(true);
    try {
      const zip = new JSZip();
      const tables = [
        { name: 'impresoras', query: supabase.from('impresoras').select('*, sectores(nombre), filiales(nombre)') },
        { name: 'lecturas_contadores', query: supabase.from('lecturas_contadores').select('*, impresoras(nombre, serie, modelo)') },
        { name: 'piezas_impresora', query: supabase.from('piezas_impresora').select('*, impresoras(nombre, serie)') },
        { name: 'historial_piezas', query: supabase.from('historial_piezas').select('*, impresoras(nombre, serie)') },
        { name: 'historial_cambios', query: supabase.from('historial_cambios').select('*, impresoras(nombre, serie)') },
        { name: 'piezas_catalogo', query: supabase.from('piezas_catalogo').select('*') },
        { name: 'configuracion_piezas', query: supabase.from('configuracion_piezas').select('*') },
        { name: 'costos_consumibles', query: supabase.from('costos_consumibles').select('*') },
        { name: 'costos_reparacion', query: supabase.from('costos_reparacion').select('*') },
        { name: 'precios_modelo', query: supabase.from('precios_modelo').select('*') },
        { name: 'filiales', query: supabase.from('filiales').select('*') },
        { name: 'sectores', query: supabase.from('sectores').select('*') },
      ];

      for (const table of tables) {
        const { data, error } = await table.query;
        if (error || !data || data.length === 0) {
          zip.file(`${table.name}.csv`, 'Sin datos');
          continue;
        }
        const flattenRow = (row: any) => {
          const flat: Record<string, string> = {};
          for (const [key, value] of Object.entries(row)) {
            if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
              for (const [subKey, subValue] of Object.entries(value as Record<string, any>)) {
                flat[`${key}_${subKey}`] = String(subValue ?? '');
              }
            } else if (Array.isArray(value)) {
              flat[key] = value.join('; ');
            } else {
              flat[key] = String(value ?? '');
            }
          }
          return flat;
        };
        const flatData = data.map(flattenRow);
        const headers = Object.keys(flatData[0]);
        const csvRows = [headers.join(','), ...flatData.map(row => headers.map(h => `"${(row[h] || '').replace(/"/g, '""')}"`).join(','))];
        zip.file(`${table.name}.csv`, csvRows.join('\n'));
      }

      const blob = await zip.generateAsync({ type: 'blob' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `backup_printcontrol_${new Date().toISOString().split('T')[0]}.zip`;
      link.click();
      toast({ title: 'Backup generado', description: 'Se descargó el archivo ZIP con todos los datos.' });
    } catch (err) {
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo generar el backup.' });
    }
    setExportingBackup(false);
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > reportConfig.maxImageSizeKB * 1024) {
      toast({ variant: 'destructive', title: 'Error', description: `El logo no debe superar ${reportConfig.maxImageSizeKB}KB.` });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => { const base64 = reader.result as string; saveCorporateLogo(base64); setLogoPreview(base64); toast({ title: 'Logo actualizado' }); };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = () => { removeCorporateLogo(); setLogoPreview(null); if (fileInputRef.current) fileInputRef.current.value = ''; toast({ title: 'Logo eliminado' }); };

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    setFetchError(null);
    try {
    const [secResp, filResp] = await Promise.all([
      supabase.from('sectores').select('*').order('nombre'),
      supabase.from('filiales').select('*').order('nombre'),
    ]);
    if (secResp.data) setSectores(secResp.data);
    if (filResp.data) setFiliales(filResp.data);
    } catch (error) {
      console.error('Error al cargar datos:', error);
      setFetchError('No se pudieron cargar los datos. Verificá tu conexión.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddSector = async () => {
    if (!newSectorName.trim()) return;
    const { error } = await supabase.from('sectores').insert({ nombre: newSectorName.trim(), descripcion: newSectorDesc.trim() || null });
    if (error) toast({ variant: 'destructive', title: 'Error', description: error.message });
    else { toast({ title: 'Éxito', description: 'Sector creado' }); setSectorDialogOpen(false); setNewSectorName(''); setNewSectorDesc(''); fetchData(); }
  };

  const handleAddFilial = async () => {
    if (!newFilialName.trim()) return;
    const { error } = await supabase.from('filiales').insert({ nombre: newFilialName.trim(), direccion: newFilialDir.trim() || null });
    if (error) toast({ variant: 'destructive', title: 'Error', description: error.message });
    else { toast({ title: 'Éxito', description: 'Filial creada' }); setFilialDialogOpen(false); setNewFilialName(''); setNewFilialDir(''); fetchData(); }
  };

  const toggleSectorActive = async (id: string, activo: boolean) => { await supabase.from('sectores').update({ activo }).eq('id', id); fetchData(); };
  const toggleFilialActive = async (id: string, activo: boolean) => { await supabase.from('filiales').update({ activo }).eq('id', id); fetchData(); };

  if (!isAdmin && !(usePermsView())) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center py-20">
          <Shield className="w-16 h-16 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">Acceso Restringido</h2>
          <p className="text-muted-foreground">Solo los administradores pueden acceder.</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10"><Settings className="w-7 h-7 text-primary" /></div>
            Configuraciones
          </h1>
          <p className="text-muted-foreground mt-1">Administración del sistema, sectores, filiales y personalización</p>
        </div>

        {fetchError && !loading ? <FetchErrorState error={fetchError} onRetry={fetchData} /> : <Accordion type="multiple" defaultValue={["sistema"]} className="space-y-3">

          <AccordionItem value="backup" className="border rounded-lg bg-card">
            <AccordionTrigger className="px-4 hover:no-underline">
              <span className="flex items-center gap-2 font-semibold"><DatabaseBackup className="w-5 h-5 text-primary" />Migración / Backup de Datos</span>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4">
        <Card className="border-0 shadow-none">
          <CardHeader>
            <CardDescription>Exporta toda la base de datos en un archivo ZIP con CSVs separados por tabla, ideal para migrar a otro entorno o guardar una copia local.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={exportDatabaseBackup} disabled={exportingBackup} className="gap-2">
              {exportingBackup ? <Loader2 className="w-4 h-4 animate-spin" /> : <DatabaseBackup className="w-4 h-4" />}
              {exportingBackup ? 'Generando backup...' : 'Descargar Backup Completo (ZIP)'}
            </Button>
            <p className="text-xs text-muted-foreground mt-2">Incluye: impresoras, lecturas, piezas, historial, catálogo, costos, filiales y sectores.</p>
          </CardContent>
        </Card>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="sistema" className="border rounded-lg bg-card">
            <AccordionTrigger className="px-4 hover:no-underline">
              <span className="flex items-center gap-2 font-semibold"><Code className="w-5 h-5 text-primary" />Configuración del Sistema</span>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4">
        <Card className="border-0 shadow-none">
          <CardHeader>
            <CardDescription>Nombre del sistema, copyright y créditos. Se muestran en el footer del sistema.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nombre del Sistema</Label>
                <Input value={systemConfig.systemName} onChange={e => setSystemConfig({ ...systemConfig, systemName: e.target.value })} placeholder="PrintControl" />
              </div>
              <div className="space-y-2">
                <Label>Texto de Copyright</Label>
                <Input value={systemConfig.copyrightText} onChange={e => setSystemConfig({ ...systemConfig, copyrightText: e.target.value })} placeholder="© 2026 PrintControl. Todos los derechos reservados." />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Texto de Desarrollador</Label>
              <Input value={systemConfig.developerText} onChange={e => setSystemConfig({ ...systemConfig, developerText: e.target.value })} placeholder="Desarrollado por: Nombre del Programador" />
            </div>
            <div className="flex justify-end">
              <Button onClick={() => { saveSystemConfig(systemConfig); toast({ title: 'Guardado', description: 'Configuración del sistema actualizada. Recarga la página para ver los cambios en el footer.' }); }}>Guardar Configuración</Button>
            </div>
          </CardContent>
        </Card>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="inactividad" className="border rounded-lg bg-card">
            <AccordionTrigger className="px-4 hover:no-underline">
              <span className="flex items-center gap-2 font-semibold"><Clock className="w-5 h-5 text-primary" />Cierre por Inactividad</span>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4">
        <Card className="border-0 shadow-none">
          <CardHeader><CardDescription>Tiempo de inactividad antes de cerrar sesión</CardDescription></CardHeader>
          <CardContent>
            <div className="flex gap-3 items-end">
              <div className="flex-1 space-y-2">
                <Label>Minutos de inactividad</Label>
                <Input
                  type="number"
                  min={5}
                  max={480}
                  value={inactivityMinutes}
                  onChange={e => {
                    const v = parseInt(e.target.value);
                    if (isNaN(v)) { setInactivityMinutes(30); return; }
                    setInactivityMinutes(Math.min(480, Math.max(5, v)));
                  }}
                />
                <p className="text-xs text-muted-foreground">Mínimo 5 minutos, máximo 480 (8 horas).</p>
                <p className="text-xs text-muted-foreground">Rango: 5 a 60 minutos</p>
              </div>
              <Button onClick={() => { saveInactivityTimeout(inactivityMinutes); toast({ title: 'Guardado', description: `Sesión se cerrará tras ${inactivityMinutes} min.` }); }}>Guardar</Button>
            </div>
          </CardContent>
        </Card>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="logo" className="border rounded-lg bg-card">
            <AccordionTrigger className="px-4 hover:no-underline">
              <span className="flex items-center gap-2 font-semibold"><ImageIcon className="w-5 h-5 text-primary" />Logo Corporativo</span>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4">
        <Card className="border-0 shadow-none">
          <CardHeader><CardDescription>Aparecerá en PDFs. Máx: {reportConfig.maxImageSizeKB}KB</CardDescription></CardHeader>
          <CardContent>
            <div className="flex items-center gap-6">
              <div className="w-24 h-24 rounded-lg border-2 border-dashed border-border flex items-center justify-center bg-muted/30 overflow-hidden shrink-0">
                {logoPreview ? <img src={logoPreview} alt="Logo" className="w-full h-full object-contain p-1" /> : <ImageIcon className="w-8 h-8 text-muted-foreground" />}
              </div>
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">PNG, JPG. Máximo {reportConfig.maxImageSizeKB}KB.</p>
                <div className="flex gap-2">
                  <input ref={fileInputRef} type="file" accept="image/png,image/jpeg" className="hidden" onChange={handleLogoUpload} />
                  <Button variant="outline" size="sm" className="gap-2" onClick={() => fileInputRef.current?.click()}><Upload className="w-4 h-4" />{logoPreview ? 'Cambiar' : 'Subir'}</Button>
                  {logoPreview && (
                    <ConfirmDeleteButton
                      onConfirm={handleRemoveLogo}
                      title="¿Eliminar logo corporativo?"
                      description="El logo se eliminará del sistema y no aparecerá en los PDFs generados."
                      showLabel
                    />
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="empresa" className="border rounded-lg bg-card">
            <AccordionTrigger className="px-4 hover:no-underline">
              <span className="flex items-center gap-2 font-semibold"><Building className="w-5 h-5 text-primary" />Nombre de Empresa</span>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4">
        <Card className="border-0 shadow-none">
          <CardHeader><CardDescription>Aparece en encabezado de PDFs</CardDescription></CardHeader>
          <CardContent>
            <div className="flex gap-3 items-end">
              <div className="flex-1 space-y-2"><Label>Nombre</Label><Input value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="Mi Empresa S.A." /></div>
              <Button onClick={() => { saveCorporateName(companyName.trim()); toast({ title: 'Guardado' }); }}>Guardar</Button>
            </div>
          </CardContent>
        </Card>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="reportes" className="border rounded-lg bg-card">
            <AccordionTrigger className="px-4 hover:no-underline">
              <span className="flex items-center gap-2 font-semibold"><FileText className="w-5 h-5 text-primary" />Configuración de Reportes</span>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4">
        <Card className="border-0 shadow-none">
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Nombre del Responsable</Label><Input value={reportConfig.responsibleName} onChange={e => setReportConfig({ ...reportConfig, responsibleName: e.target.value })} placeholder="Juan Pérez" /></div>
              <div className="space-y-2">
                <Label>Formato por defecto</Label>
                <Select value={reportConfig.defaultFormat} onValueChange={v => setReportConfig({ ...reportConfig, defaultFormat: v as 'pdf' | 'csv' })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-popover"><SelectItem value="pdf">PDF</SelectItem><SelectItem value="csv">CSV (Excel)</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Tamaño máximo imágenes (KB)</Label><Input type="number" min={100} max={5000} value={reportConfig.maxImageSizeKB} onChange={e => setReportConfig({ ...reportConfig, maxImageSizeKB: parseInt(e.target.value) || 500 })} /></div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div><Label>Mostrar firma en reportes</Label><p className="text-xs text-muted-foreground">Pie de cada PDF</p></div>
                <Switch checked={reportConfig.showSignature} onCheckedChange={checked => setReportConfig({ ...reportConfig, showSignature: checked })} />
              </div>
            </div>
            <div className="space-y-2"><Label>Texto de encabezado</Label><Input value={reportConfig.headerText} onChange={e => setReportConfig({ ...reportConfig, headerText: e.target.value })} placeholder="Departamento de Sistemas" /></div>
            <div className="space-y-2"><Label>Texto de pie de página</Label><Input value={reportConfig.footerText} onChange={e => setReportConfig({ ...reportConfig, footerText: e.target.value })} placeholder="Documento confidencial" /></div>
            <div className="flex justify-end"><Button onClick={() => { saveReportConfig(reportConfig); toast({ title: 'Guardado' }); }}>Guardar Configuración</Button></div>
          </CardContent>
        </Card>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="widgets" className="border rounded-lg bg-card">
            <AccordionTrigger className="px-4 hover:no-underline">
              <span className="flex items-center gap-2 font-semibold"><LayoutDashboard className="w-5 h-5 text-primary" />Widgets del Dashboard</span>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4">
              <Card className="border-0 shadow-none">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardDescription>Activá o desactivá cada sección del panel principal</CardDescription>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs text-muted-foreground"
                      onClick={() => {
                        const reset = [...WIDGET_DEFAULTS];
                        setWidgetsConfig(reset);
                        saveWidgetsConfig(reset);
                        toast({ title: 'Restaurado', description: 'Widgets restaurados a valores por defecto.' });
                      }}
                    >
                      Restaurar todo
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-0 p-0">
                  {widgetsConfig.map((widget, idx) => (
                    <div
                      key={widget.id}
                      className={`flex items-center justify-between px-6 py-3 ${idx !== widgetsConfig.length - 1 ? 'border-b border-border/40' : ''}`}
                    >
                      <div className="flex-1 min-w-0 mr-4">
                        <p className="text-sm font-medium">{widget.label}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{widget.descripcion}</p>
                      </div>
                      <Switch
                        checked={widget.enabled}
                        onCheckedChange={(checked) => {
                          const updated = widgetsConfig.map(w => w.id === widget.id ? { ...w, enabled: checked } : w);
                          setWidgetsConfig(updated);
                          saveWidgetsConfig(updated);
                        }}
                      />
                    </div>
                  ))}
                </CardContent>
              </Card>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="ubicaciones" className="border rounded-lg bg-card">
            <AccordionTrigger className="px-4 hover:no-underline">
              <span className="flex items-center gap-2 font-semibold"><MapPin className="w-5 h-5 text-primary" />Sectores y Filiales</span>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Sectores */}
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div><CardTitle className="flex items-center gap-2"><MapPin className="w-5 h-5" />Sectores</CardTitle><CardDescription>Áreas de ubicación</CardDescription></div>
                <Dialog open={sectorDialogOpen} onOpenChange={setSectorDialogOpen}>
                  <DialogTrigger asChild><Button size="sm" className="gap-1"><Plus className="w-4 h-4" />Nuevo</Button></DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Nuevo Sector</DialogTitle></DialogHeader>
                    <div className="space-y-4">
                      <div className="space-y-2"><Label>Nombre *</Label><Input value={newSectorName} onChange={e => setNewSectorName(e.target.value)} placeholder="Administración" /></div>
                      <div className="space-y-2"><Label>Descripción</Label><Input value={newSectorDesc} onChange={e => setNewSectorDesc(e.target.value)} placeholder="Opcional" /></div>
                      <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setSectorDialogOpen(false)}>Cancelar</Button><Button onClick={handleAddSector}>Crear</Button></div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? <div className="flex justify-center py-4"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div> : sectores.length === 0 ? <p className="text-center text-muted-foreground py-4">No hay sectores</p> : (
                <div className="space-y-2">
                  {sectores.map(sector => (
                    <div key={sector.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <div><p className="font-medium">{sector.nombre}</p>{sector.descripcion && <p className="text-sm text-muted-foreground">{sector.descripcion}</p>}</div>
                      <Switch checked={sector.activo} onCheckedChange={checked => toggleSectorActive(sector.id, checked)} />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Filiales */}
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div><CardTitle className="flex items-center gap-2"><Building className="w-5 h-5" />Filiales</CardTitle><CardDescription>Sucursales</CardDescription></div>
                <Dialog open={filialDialogOpen} onOpenChange={setFilialDialogOpen}>
                  <DialogTrigger asChild><Button size="sm" className="gap-1"><Plus className="w-4 h-4" />Nueva</Button></DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Nueva Filial</DialogTitle></DialogHeader>
                    <div className="space-y-4">
                      <div className="space-y-2"><Label>Nombre *</Label><Input value={newFilialName} onChange={e => setNewFilialName(e.target.value)} placeholder="Sede Central" /></div>
                      <div className="space-y-2"><Label>Dirección</Label><Input value={newFilialDir} onChange={e => setNewFilialDir(e.target.value)} placeholder="Opcional" /></div>
                      <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setFilialDialogOpen(false)}>Cancelar</Button><Button onClick={handleAddFilial}>Crear</Button></div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? <div className="flex justify-center py-4"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div> : filiales.length === 0 ? <p className="text-center text-muted-foreground py-4">No hay filiales</p> : (
                <div className="space-y-2">
                  {filiales.map(filial => (
                    <div key={filial.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <div><p className="font-medium">{filial.nombre}</p>{filial.direccion && <p className="text-sm text-muted-foreground">{filial.direccion}</p>}</div>
                      <Switch checked={filial.activo} onCheckedChange={checked => toggleFilialActive(filial.id, checked)} />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>}
      </div>
    </DashboardLayout>
  );
}
