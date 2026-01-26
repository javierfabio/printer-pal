import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Building, Loader2, MapPin, Plus, Shield, Trash2, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface Sector {
  id: string;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
}

interface Filial {
  id: string;
  nombre: string;
  direccion: string | null;
  activo: boolean;
}

interface UserWithRole {
  id: string;
  email: string;
  full_name: string | null;
  role: 'admin' | 'user';
}

export default function Configuraciones() {
  const { role } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [sectores, setSectores] = useState<Sector[]>([]);
  const [filiales, setFiliales] = useState<Filial[]>([]);
  const [users, setUsers] = useState<UserWithRole[]>([]);
  
  // Dialog states
  const [sectorDialogOpen, setSectorDialogOpen] = useState(false);
  const [filialDialogOpen, setFilialDialogOpen] = useState(false);
  const [newSectorName, setNewSectorName] = useState('');
  const [newSectorDesc, setNewSectorDesc] = useState('');
  const [newFilialName, setNewFilialName] = useState('');
  const [newFilialDir, setNewFilialDir] = useState('');

  const isAdmin = role === 'admin';

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    
    const [secResp, filResp, usersResp] = await Promise.all([
      supabase.from('sectores').select('*').order('nombre'),
      supabase.from('filiales').select('*').order('nombre'),
      supabase.from('profiles').select('*, user_roles(role)'),
    ]);

    if (secResp.data) setSectores(secResp.data);
    if (filResp.data) setFiliales(filResp.data);
    if (usersResp.data) {
      setUsers(usersResp.data.map((u: any) => ({
        id: u.id,
        email: u.email,
        full_name: u.full_name,
        role: u.user_roles?.[0]?.role || 'user',
      })));
    }
    
    setLoading(false);
  };

  const handleAddSector = async () => {
    if (!newSectorName.trim()) return;
    
    const { error } = await supabase.from('sectores').insert({
      nombre: newSectorName.trim(),
      descripcion: newSectorDesc.trim() || null,
    });

    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } else {
      toast({ title: 'Éxito', description: 'Sector creado' });
      setSectorDialogOpen(false);
      setNewSectorName('');
      setNewSectorDesc('');
      fetchData();
    }
  };

  const handleAddFilial = async () => {
    if (!newFilialName.trim()) return;
    
    const { error } = await supabase.from('filiales').insert({
      nombre: newFilialName.trim(),
      direccion: newFilialDir.trim() || null,
    });

    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } else {
      toast({ title: 'Éxito', description: 'Filial creada' });
      setFilialDialogOpen(false);
      setNewFilialName('');
      setNewFilialDir('');
      fetchData();
    }
  };

  const toggleSectorActive = async (id: string, activo: boolean) => {
    const { error } = await supabase.from('sectores').update({ activo }).eq('id', id);
    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } else {
      fetchData();
    }
  };

  const toggleFilialActive = async (id: string, activo: boolean) => {
    const { error } = await supabase.from('filiales').update({ activo }).eq('id', id);
    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } else {
      fetchData();
    }
  };

  const updateUserRole = async (userId: string, newRole: 'admin' | 'user') => {
    // First, try to update existing role
    const { data: existing } = await supabase
      .from('user_roles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (existing) {
      const { error } = await supabase
        .from('user_roles')
        .update({ role: newRole })
        .eq('user_id', userId);
      
      if (error) {
        toast({ variant: 'destructive', title: 'Error', description: error.message });
        return;
      }
    } else {
      const { error } = await supabase
        .from('user_roles')
        .insert({ user_id: userId, role: newRole });
      
      if (error) {
        toast({ variant: 'destructive', title: 'Error', description: error.message });
        return;
      }
    }

    toast({ title: 'Éxito', description: 'Rol actualizado' });
    fetchData();
  };

  if (!isAdmin) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center py-20">
          <Shield className="w-16 h-16 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">Acceso Restringido</h2>
          <p className="text-muted-foreground">Solo los administradores pueden acceder a esta sección.</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">Configuraciones</h1>
          <p className="text-muted-foreground">Administración del sistema</p>
        </div>

        <Tabs defaultValue="ubicaciones" className="space-y-6">
          <TabsList>
            <TabsTrigger value="ubicaciones" className="gap-2">
              <MapPin className="w-4 h-4" />
              Ubicaciones
            </TabsTrigger>
            <TabsTrigger value="usuarios" className="gap-2">
              <Users className="w-4 h-4" />
              Usuarios
            </TabsTrigger>
          </TabsList>

          <TabsContent value="ubicaciones" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Sectores */}
              <Card>
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <MapPin className="w-5 h-5" />
                        Sectores
                      </CardTitle>
                      <CardDescription>Áreas de ubicación de impresoras</CardDescription>
                    </div>
                    <Dialog open={sectorDialogOpen} onOpenChange={setSectorDialogOpen}>
                      <DialogTrigger asChild>
                        <Button size="sm" className="gap-1">
                          <Plus className="w-4 h-4" />
                          Nuevo
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Nuevo Sector</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label>Nombre *</Label>
                            <Input
                              value={newSectorName}
                              onChange={e => setNewSectorName(e.target.value)}
                              placeholder="Ej: Administración"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Descripción</Label>
                            <Input
                              value={newSectorDesc}
                              onChange={e => setNewSectorDesc(e.target.value)}
                              placeholder="Descripción opcional"
                            />
                          </div>
                          <div className="flex justify-end gap-2">
                            <Button variant="outline" onClick={() => setSectorDialogOpen(false)}>
                              Cancelar
                            </Button>
                            <Button onClick={handleAddSector}>Crear</Button>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="flex justify-center py-4">
                      <Loader2 className="w-6 h-6 animate-spin text-primary" />
                    </div>
                  ) : sectores.length === 0 ? (
                    <p className="text-center text-muted-foreground py-4">No hay sectores</p>
                  ) : (
                    <div className="space-y-2">
                      {sectores.map(sector => (
                        <div
                          key={sector.id}
                          className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                        >
                          <div>
                            <p className="font-medium">{sector.nombre}</p>
                            {sector.descripcion && (
                              <p className="text-sm text-muted-foreground">{sector.descripcion}</p>
                            )}
                          </div>
                          <Switch
                            checked={sector.activo}
                            onCheckedChange={checked => toggleSectorActive(sector.id, checked)}
                          />
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
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Building className="w-5 h-5" />
                        Filiales
                      </CardTitle>
                      <CardDescription>Sucursales o sedes</CardDescription>
                    </div>
                    <Dialog open={filialDialogOpen} onOpenChange={setFilialDialogOpen}>
                      <DialogTrigger asChild>
                        <Button size="sm" className="gap-1">
                          <Plus className="w-4 h-4" />
                          Nueva
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Nueva Filial</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label>Nombre *</Label>
                            <Input
                              value={newFilialName}
                              onChange={e => setNewFilialName(e.target.value)}
                              placeholder="Ej: Sede Central"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Dirección</Label>
                            <Input
                              value={newFilialDir}
                              onChange={e => setNewFilialDir(e.target.value)}
                              placeholder="Dirección opcional"
                            />
                          </div>
                          <div className="flex justify-end gap-2">
                            <Button variant="outline" onClick={() => setFilialDialogOpen(false)}>
                              Cancelar
                            </Button>
                            <Button onClick={handleAddFilial}>Crear</Button>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="flex justify-center py-4">
                      <Loader2 className="w-6 h-6 animate-spin text-primary" />
                    </div>
                  ) : filiales.length === 0 ? (
                    <p className="text-center text-muted-foreground py-4">No hay filiales</p>
                  ) : (
                    <div className="space-y-2">
                      {filiales.map(filial => (
                        <div
                          key={filial.id}
                          className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                        >
                          <div>
                            <p className="font-medium">{filial.nombre}</p>
                            {filial.direccion && (
                              <p className="text-sm text-muted-foreground">{filial.direccion}</p>
                            )}
                          </div>
                          <Switch
                            checked={filial.activo}
                            onCheckedChange={checked => toggleFilialActive(filial.id, checked)}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="usuarios">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Gestión de Usuarios
                </CardTitle>
                <CardDescription>
                  Administra los roles de los usuarios del sistema
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  </div>
                ) : users.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No hay usuarios</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Email</TableHead>
                        <TableHead>Nombre</TableHead>
                        <TableHead>Rol</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users.map(user => (
                        <TableRow key={user.id}>
                          <TableCell>{user.email}</TableCell>
                          <TableCell>{user.full_name || '-'}</TableCell>
                          <TableCell>
                            <span className={cn(
                              "px-2 py-1 rounded-full text-xs font-medium",
                              user.role === 'admin' 
                                ? "bg-primary/10 text-primary" 
                                : "bg-muted text-muted-foreground"
                            )}>
                              {user.role === 'admin' ? 'Administrador' : 'Usuario'}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <Select
                              value={user.role}
                              onValueChange={(value: 'admin' | 'user') => updateUserRole(user.id, value)}
                            >
                              <SelectTrigger className="w-32">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="user">Usuario</SelectItem>
                                <SelectItem value="admin">Admin</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
