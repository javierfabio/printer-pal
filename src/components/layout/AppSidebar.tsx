import { Home, FileText, Printer, Settings, LogOut, Moon, Sun, ChevronLeft, BarChart3, History, ClipboardList, Users, Wrench } from 'lucide-react';
import { NavLink, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';

interface MenuItem {
  title: string;
  url: string;
  icon: React.ElementType;
  adminOnly?: boolean;
  priority?: boolean;
}

const menuItems: MenuItem[] = [
  { title: 'Inicio', url: '/dashboard', icon: Home },
  { title: 'Registro de Uso', url: '/dashboard/registro-uso', icon: ClipboardList, priority: true },
  { title: 'Gestión de Piezas', url: '/dashboard/piezas', icon: Wrench },
  { title: 'Registrar Impresora', url: '/dashboard/impresoras', icon: Printer, adminOnly: true },
  { title: 'Informes', url: '/dashboard/informes', icon: BarChart3 },
  { title: 'Historial', url: '/dashboard/historial', icon: History },
  { title: 'Usuarios', url: '/dashboard/usuarios', icon: Users, adminOnly: true },
  { title: 'Configuraciones', url: '/dashboard/configuraciones', icon: Settings, adminOnly: true },
];

export function AppSidebar() {
  const { signOut, user, role } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  const isAdmin = role === 'admin';

  const visibleItems = menuItems.filter(item => !item.adminOnly || isAdmin);

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          "h-screen gradient-sidebar border-r border-sidebar-border transition-all duration-300 flex flex-col sticky top-0",
          collapsed ? "w-16" : "w-64"
        )}
      >
        {/* Header */}
        <div className="p-4 border-b border-sidebar-border">
          <div className="flex items-center justify-between">
            {!collapsed && (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg gradient-primary flex items-center justify-center shadow-lg shadow-primary/20">
                  <Printer className="w-5 h-5 text-primary-foreground" />
                </div>
                <div>
                  <h1 className="text-lg font-bold text-sidebar-foreground">PrintControl</h1>
                  <p className="text-xs text-sidebar-foreground/60">Control de Contadores</p>
                </div>
              </div>
            )}
            {collapsed && (
              <div className="mx-auto w-10 h-10 rounded-lg gradient-primary flex items-center justify-center">
                <Printer className="w-5 h-5 text-primary-foreground" />
              </div>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCollapsed(!collapsed)}
            className={cn(
              "text-sidebar-foreground hover:bg-sidebar-accent mt-2",
              collapsed ? "mx-auto" : "ml-auto"
            )}
          >
            <ChevronLeft className={cn("w-4 h-4 transition-transform duration-200", collapsed && "rotate-180")} />
          </Button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {visibleItems.map((item) => {
            const isActive = location.pathname === item.url;
            const linkContent = (
              <NavLink
                key={item.url}
                to={item.url}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200",
                  isActive
                    ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-lg shadow-sidebar-primary/20"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground",
                  item.priority && !isActive && "bg-sidebar-accent/50 border border-sidebar-border",
                  collapsed && "justify-center px-2"
                )}
              >
                <item.icon className={cn("w-5 h-5 flex-shrink-0", item.priority && "text-primary")} />
                {!collapsed && (
                  <span className={cn("font-medium", item.priority && "text-primary")}>
                    {item.title}
                  </span>
                )}
                {!collapsed && item.priority && (
                  <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-primary/20 text-primary font-semibold">
                    NUEVO
                  </span>
                )}
              </NavLink>
            );

            if (collapsed) {
              return (
                <Tooltip key={item.url}>
                  <TooltipTrigger asChild>
                    {linkContent}
                  </TooltipTrigger>
                  <TooltipContent side="right" className="bg-popover text-popover-foreground">
                    {item.title}
                  </TooltipContent>
                </Tooltip>
              );
            }

            return linkContent;
          })}
        </nav>

        {/* Footer */}
        <div className="p-3 border-t border-sidebar-border space-y-2">
          {/* User info */}
          {!collapsed && (
            <div className="px-3 py-2 mb-2 rounded-lg bg-sidebar-accent/30">
              <p className="text-sm text-sidebar-foreground truncate font-medium">{user?.email}</p>
              <span className={cn(
                "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium mt-1",
                role === 'admin' 
                  ? "bg-primary/20 text-primary" 
                  : "bg-sidebar-accent text-sidebar-foreground/70"
              )}>
                {role === 'admin' ? 'Administrador' : 'Usuario de Registro'}
              </span>
            </div>
          )}

          {/* Theme toggle */}
          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={toggleTheme}
                  className="w-full text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                >
                  {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right" className="bg-popover text-popover-foreground">
                {theme === 'dark' ? 'Modo Claro' : 'Modo Oscuro'}
              </TooltipContent>
            </Tooltip>
          ) : (
            <Button
              variant="ghost"
              onClick={toggleTheme}
              className="w-full justify-start gap-3 text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
            >
              {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              <span>{theme === 'dark' ? 'Modo Claro' : 'Modo Oscuro'}</span>
            </Button>
          )}

          {/* Logout */}
          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={signOut}
                  className="w-full text-destructive hover:bg-destructive/10 hover:text-destructive"
                >
                  <LogOut className="w-5 h-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right" className="bg-popover text-popover-foreground">
                Salir
              </TooltipContent>
            </Tooltip>
          ) : (
            <Button
              variant="ghost"
              onClick={signOut}
              className="w-full justify-start gap-3 text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              <LogOut className="w-5 h-5" />
              <span>Salir</span>
            </Button>
          )}
        </div>
      </aside>
    </TooltipProvider>
  );
}
