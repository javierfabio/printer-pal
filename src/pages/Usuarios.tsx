import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { 
  Users, 
  Shield, 
  Loader2,
  UserCheck,
  Clock
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { AddUserDialog } from '@/components/users/AddUserDialog';

interface UserWithRole {
  id: string;
  email: string;
  full_name: string | null;
  created_at: string;
  role: 'admin' | 'user';
}

export default function Usuarios() {
  const { role, user: currentUser } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [updating, setUpdating] = useState<string | null>(null);

  const isAdmin = role === 'admin';

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    
    const { data, error } = await supabase
      .from('profiles')
      .select('*, user_roles(role)')
      .order('created_at', { ascending: false });

    if (data && !error) {
      setUsers(data.map((u: any) => ({
        id: u.id,
        email: u.email,
        full_name: u.full_name,
        created_at: u.created_at,
        role: u.user_roles?.[0]?.role || 'user',
      })));
    }
    
    setLoading(false);
  };

  const updateUserRole = async (userId: string, newRole: 'admin' | 'user') => {
    if (userId === currentUser?.id) {
      toast({ 
        variant: 'destructive', 
        title: 'Error', 
        description: 'No puedes cambiar tu propio rol.' 
      });
      return;
    }

    setUpdating(userId);

    // Check if role exists
    const { data: existing } = await supabase
      .from('user_roles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    let error;
    if (existing) {
      const result = await supabase
        .from('user_roles')
        .update({ role: newRole })
        .eq('user_id', userId);
      error = result.error;
    } else {
      const result = await supabase
        .from('user_roles')
        .insert({ user_id: userId, role: newRole });
      error = result.error;
    }

    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } else {
      toast({ title: 'Éxito', description: 'Rol actualizado correctamente.' });
      fetchUsers();
    }

    setUpdating(null);
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

  const adminCount = users.filter(u => u.role === 'admin').length;
  const userCount = users.filter(u => u.role === 'user').length;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Users className="w-7 h-7 text-primary" />
              </div>
              Gestión de Usuarios
            </h1>
            <p className="text-muted-foreground mt-1">
              Administra los usuarios y sus roles en el sistema
            </p>
          </div>
          <AddUserDialog onUserAdded={fetchUsers} />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-primary/10">
                  <Users className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Usuarios</p>
                  <p className="text-2xl font-bold">{users.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-warning/10">
                  <Shield className="w-6 h-6 text-warning" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Administradores</p>
                  <p className="text-2xl font-bold">{adminCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-success/10">
                  <UserCheck className="w-6 h-6 text-success" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Usuarios de Registro</p>
                  <p className="text-2xl font-bold">{userCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Users Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Lista de Usuarios
            </CardTitle>
            <CardDescription>
              Asigna roles a los usuarios para controlar sus permisos
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : users.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Users className="w-16 h-16 mx-auto mb-4 opacity-30" />
                <p>No hay usuarios registrados</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Usuario</TableHead>
                      <TableHead>Fecha de Registro</TableHead>
                      <TableHead>Rol Actual</TableHead>
                      <TableHead className="text-right">Cambiar Rol</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map(user => (
                      <TableRow key={user.id} className="hover:bg-muted/50">
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              "w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold",
                              user.role === 'admin' ? "bg-primary" : "bg-muted-foreground"
                            )}>
                              {(user.full_name || user.email).charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-medium">{user.full_name || 'Sin nombre'}</p>
                              <p className="text-sm text-muted-foreground">{user.email}</p>
                            </div>
                            {user.id === currentUser?.id && (
                              <Badge variant="outline" className="ml-2">Tú</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Clock className="w-4 h-4" />
                            {new Date(user.created_at).toLocaleDateString('es', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric'
                            })}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant="outline"
                            className={cn(
                              user.role === 'admin' 
                                ? "bg-primary/10 text-primary border-primary/20" 
                                : "bg-muted text-muted-foreground"
                            )}
                          >
                            {user.role === 'admin' ? (
                              <><Shield className="w-3 h-3 mr-1" /> Administrador</>
                            ) : (
                              <><UserCheck className="w-3 h-3 mr-1" /> Usuario de Registro</>
                            )}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Select
                            value={user.role}
                            onValueChange={(value: 'admin' | 'user') => updateUserRole(user.id, value)}
                            disabled={user.id === currentUser?.id || updating === user.id}
                          >
                            <SelectTrigger className="w-40">
                              {updating === user.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <SelectValue />
                              )}
                            </SelectTrigger>
                            <SelectContent className="bg-popover">
                              <SelectItem value="user">
                                <div className="flex items-center gap-2">
                                  <UserCheck className="w-4 h-4" />
                                  Usuario de Registro
                                </div>
                              </SelectItem>
                              <SelectItem value="admin">
                                <div className="flex items-center gap-2">
                                  <Shield className="w-4 h-4" />
                                  Administrador
                                </div>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Role explanation */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-primary">
                <Shield className="w-5 h-5" />
                Administrador
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-2">
              <p>• Acceso completo a todas las funciones</p>
              <p>• Puede registrar y editar impresoras</p>
              <p>• Gestión de usuarios y roles</p>
              <p>• Acceso a configuraciones del sistema</p>
              <p>• Visualización de todos los informes</p>
            </CardContent>
          </Card>
          
          <Card className="border-success/20 bg-success/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-success">
                <UserCheck className="w-5 h-5" />
                Usuario de Registro
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-2">
              <p>• Registrar lecturas de contadores</p>
              <p>• Ver historial de sus registros</p>
              <p>• Acceso a informes básicos</p>
              <p>• Sin acceso a configuraciones</p>
              <p>• Sin permisos de edición de impresoras</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
