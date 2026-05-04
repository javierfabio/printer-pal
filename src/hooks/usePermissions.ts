import { useAuth } from '@/contexts/AuthContext';

export interface UserPermissions {
  can_view_impresoras: boolean;
  can_create_impresoras: boolean;
  can_edit_impresoras: boolean;
  can_delete_impresoras: boolean;
  can_view_lecturas: boolean;
  can_create_lecturas: boolean;
  can_delete_lecturas: boolean;
  can_view_piezas: boolean;
  can_edit_piezas: boolean;
  can_view_costos: boolean;
  can_edit_costos: boolean;
  can_view_historial: boolean;
  can_view_informes: boolean;
  can_export_informes: boolean;
  can_view_config: boolean;
}

export const ADMIN_PERMISSIONS: UserPermissions = {
  can_view_impresoras: true, can_create_impresoras: true,
  can_edit_impresoras: true, can_delete_impresoras: true,
  can_view_lecturas: true, can_create_lecturas: true,
  can_delete_lecturas: true, can_view_piezas: true,
  can_edit_piezas: true, can_view_costos: true,
  can_edit_costos: true, can_view_historial: true,
  can_view_informes: true, can_export_informes: true,
  can_view_config: true,
};

export const DEFAULT_USER_PERMISSIONS: UserPermissions = {
  can_view_impresoras: true, can_create_impresoras: false,
  can_edit_impresoras: false, can_delete_impresoras: false,
  can_view_lecturas: true, can_create_lecturas: true,
  can_delete_lecturas: false, can_view_piezas: true,
  can_edit_piezas: false, can_view_costos: false,
  can_edit_costos: false, can_view_historial: true,
  can_view_informes: false, can_export_informes: false,
  can_view_config: false,
};

export function usePermissions(): UserPermissions & { loading: boolean } {
  const { role, permissions, permissionsLoading } = useAuth();

  if (role === 'admin') {
    return { ...ADMIN_PERMISSIONS, loading: false };
  }
  if (permissions) {
    return { ...permissions, loading: permissionsLoading };
  }
  return { ...DEFAULT_USER_PERMISSIONS, loading: permissionsLoading };
}
