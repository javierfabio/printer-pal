import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";

import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Impresoras from "./pages/Impresoras";
import Piezas from "./pages/Piezas";
import Informes from "./pages/Informes";
import Configuraciones from "./pages/Configuraciones";
import RegistroUso from "./pages/RegistroUso";
import Historial from "./pages/Historial";
import Usuarios from "./pages/Usuarios";
import Costos from "./pages/Costos";

import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<Auth />} />
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <Dashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard/registro-uso"
                element={
                  <ProtectedRoute>
                    <RegistroUso />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard/piezas"
                element={
                  <ProtectedRoute>
                    <Piezas />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard/impresoras"
                element={
                  <ProtectedRoute requireAdmin>
                    <Impresoras />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard/informes"
                element={
                  <ProtectedRoute>
                    <Informes />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard/historial"
                element={
                  <ProtectedRoute>
                    <Historial />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard/usuarios"
                element={
                  <ProtectedRoute requireAdmin>
                    <Usuarios />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard/costos"
                element={
                  <ProtectedRoute>
                    <Costos />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard/catalogo-piezas"
                element={
                  <ProtectedRoute>
                    <CatalogoPiezas />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard/configuraciones"
                element={
                  <ProtectedRoute requireAdmin>
                    <Configuraciones />
                  </ProtectedRoute>
                }
              />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
