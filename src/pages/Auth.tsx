import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Printer, Loader2, AlertCircle, Eye, EyeOff, Shield, Globe, ChevronDown } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { z } from 'zod';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
});

const signupSchema = z.object({
  fullName: z.string().min(2, 'El nombre debe tener al menos 2 caracteres').max(100),
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
  confirmPassword: z.string(),
}).refine(data => data.password === data.confirmPassword, {
  message: 'Las contraseñas no coinciden',
  path: ['confirmPassword'],
});

type Language = 'es' | 'en';

const translations = {
  es: {
    title: 'PrintControl',
    subtitle: 'Sistema de Control de Impresoras',
    login: 'Iniciar Sesión',
    signup: 'Registrarse',
    email: 'Correo electrónico',
    password: 'Contraseña',
    confirmPassword: 'Confirmar Contraseña',
    fullName: 'Nombre Completo',
    rememberMe: 'Recordar sesión',
    forgotPassword: '¿Olvidaste tu contraseña?',
    enable2FA: 'Activar verificación en dos pasos',
    loginButton: 'Iniciar Sesión',
    signupButton: 'Crear Cuenta',
    emailPlaceholder: 'correo@ejemplo.com',
    passwordPlaceholder: '••••••••',
    namePlaceholder: 'Juan Pérez',
    errorLogin: 'Error al iniciar sesión',
    errorSignup: 'Error al registrarse',
    invalidCredentials: 'Credenciales incorrectas',
    alreadyRegistered: 'Este email ya está registrado',
    accountCreated: 'Cuenta creada',
    accountCreatedDesc: 'Tu cuenta ha sido creada exitosamente.',
    secureConnection: 'Conexión segura',
    allRightsReserved: 'Todos los derechos reservados',
  },
  en: {
    title: 'PrintControl',
    subtitle: 'Printer Control System',
    login: 'Sign In',
    signup: 'Sign Up',
    email: 'Email',
    password: 'Password',
    confirmPassword: 'Confirm Password',
    fullName: 'Full Name',
    rememberMe: 'Remember me',
    forgotPassword: 'Forgot your password?',
    enable2FA: 'Enable two-factor authentication',
    loginButton: 'Sign In',
    signupButton: 'Create Account',
    emailPlaceholder: 'email@example.com',
    passwordPlaceholder: '••••••••',
    namePlaceholder: 'John Doe',
    errorLogin: 'Login error',
    errorSignup: 'Signup error',
    invalidCredentials: 'Invalid credentials',
    alreadyRegistered: 'This email is already registered',
    accountCreated: 'Account created',
    accountCreatedDesc: 'Your account has been created successfully.',
    secureConnection: 'Secure connection',
    allRightsReserved: 'All rights reserved',
  },
};

export default function Auth() {
  const navigate = useNavigate();
  const { signIn, signUp, user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [enable2FA, setEnable2FA] = useState(false);
  const [language, setLanguage] = useState<Language>('es');

  const t = translations[language];

  // Load saved language preference
  useEffect(() => {
    const savedLang = localStorage.getItem('preferredLanguage') as Language;
    if (savedLang && (savedLang === 'es' || savedLang === 'en')) {
      setLanguage(savedLang);
    }
  }, []);

  const changeLanguage = (lang: Language) => {
    setLanguage(lang);
    localStorage.setItem('preferredLanguage', lang);
  };

  // Redirect if already logged in
  if (user) {
    navigate('/dashboard', { replace: true });
    return null;
  }

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrors({});
    
    const formData = new FormData(e.currentTarget);
    const data = {
      email: formData.get('email') as string,
      password: formData.get('password') as string,
    };

    const result = loginSchema.safeParse(data);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach(err => {
        if (err.path[0]) fieldErrors[err.path[0] as string] = err.message;
      });
      setErrors(fieldErrors);
      return;
    }

    setLoading(true);
    const { error } = await signIn(data.email, data.password);
    setLoading(false);

    if (error) {
      toast({
        variant: 'destructive',
        title: t.errorLogin,
        description: error.message === 'Invalid login credentials' 
          ? t.invalidCredentials 
          : error.message,
      });
    } else {
      if (rememberMe) {
        localStorage.setItem('rememberSession', 'true');
      }
      navigate('/dashboard');
    }
  };

  const handleSignup = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrors({});
    
    const formData = new FormData(e.currentTarget);
    const data = {
      fullName: formData.get('fullName') as string,
      email: formData.get('email') as string,
      password: formData.get('password') as string,
      confirmPassword: formData.get('confirmPassword') as string,
    };

    const result = signupSchema.safeParse(data);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach(err => {
        if (err.path[0]) fieldErrors[err.path[0] as string] = err.message;
      });
      setErrors(fieldErrors);
      return;
    }

    setLoading(true);
    const { error } = await signUp(data.email, data.password, data.fullName);
    setLoading(false);

    if (error) {
      let message = error.message;
      if (error.message.includes('already registered')) {
        message = t.alreadyRegistered;
      }
      toast({
        variant: 'destructive',
        title: t.errorSignup,
        description: message,
      });
    } else {
      toast({
        title: t.accountCreated,
        description: t.accountCreatedDesc,
      });
      navigate('/dashboard');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative overflow-hidden">
      {/* Animated background */}
      <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-primary/5" />
      <div className="absolute inset-0">
        <div className="absolute top-0 left-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      {/* Language selector */}
      <div className="absolute top-4 right-4 z-20">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-foreground">
              <Globe className="w-4 h-4" />
              {language === 'es' ? 'Español' : 'English'}
              <ChevronDown className="w-3 h-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-card">
            <DropdownMenuItem onClick={() => changeLanguage('es')}>
              🇪🇸 Español
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => changeLanguage('en')}>
              🇺🇸 English
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      
      <Card className="w-full max-w-md relative z-10 shadow-2xl animate-fade-in border-border/50 backdrop-blur-sm bg-card/95">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto w-20 h-20 rounded-2xl gradient-primary flex items-center justify-center mb-4 shadow-lg shadow-primary/25 animate-scale-in">
            <Printer className="w-10 h-10 text-primary-foreground" />
          </div>
          <CardTitle className="text-3xl font-bold tracking-tight">{t.title}</CardTitle>
          <CardDescription className="text-muted-foreground">{t.subtitle}</CardDescription>
        </CardHeader>

        <CardContent>
          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6 bg-muted/50">
              <TabsTrigger value="login" className="data-[state=active]:bg-background data-[state=active]:shadow-sm">
                {t.login}
              </TabsTrigger>
              <TabsTrigger value="signup" className="data-[state=active]:bg-background data-[state=active]:shadow-sm">
                {t.signup}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="login" className="animate-fade-in">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login-email" className="text-sm font-medium">{t.email}</Label>
                  <Input
                    id="login-email"
                    name="email"
                    type="email"
                    placeholder={t.emailPlaceholder}
                    required
                    className={cn(
                      "transition-all duration-200",
                      errors.email && "border-destructive ring-destructive/20 ring-2"
                    )}
                    aria-invalid={!!errors.email}
                    aria-describedby={errors.email ? "email-error" : undefined}
                  />
                  {errors.email && (
                    <p id="email-error" className="text-sm text-destructive flex items-center gap-1 animate-fade-in" role="alert">
                      <AlertCircle className="w-3 h-3" /> {errors.email}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="login-password" className="text-sm font-medium">{t.password}</Label>
                  <div className="relative">
                    <Input
                      id="login-password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      placeholder={t.passwordPlaceholder}
                      required
                      className={cn(
                        "pr-10 transition-all duration-200",
                        errors.password && "border-destructive ring-destructive/20 ring-2"
                      )}
                      aria-invalid={!!errors.password}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4 text-muted-foreground" />
                      ) : (
                        <Eye className="w-4 h-4 text-muted-foreground" />
                      )}
                    </Button>
                  </div>
                  {errors.password && (
                    <p className="text-sm text-destructive flex items-center gap-1 animate-fade-in" role="alert">
                      <AlertCircle className="w-3 h-3" /> {errors.password}
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="remember" 
                      checked={rememberMe}
                      onCheckedChange={(checked) => setRememberMe(checked === true)}
                    />
                    <Label htmlFor="remember" className="text-sm text-muted-foreground cursor-pointer">
                      {t.rememberMe}
                    </Label>
                  </div>
                  <Button type="button" variant="link" className="text-sm p-0 h-auto text-primary">
                    {t.forgotPassword}
                  </Button>
                </div>

                {/* 2FA Option */}
                <div className="flex items-center space-x-2 p-3 rounded-lg bg-muted/50 border border-border/50">
                  <Shield className="w-4 h-4 text-primary" />
                  <div className="flex-1">
                    <Label htmlFor="2fa" className="text-sm cursor-pointer">
                      {t.enable2FA}
                    </Label>
                  </div>
                  <Checkbox 
                    id="2fa" 
                    checked={enable2FA}
                    onCheckedChange={(checked) => setEnable2FA(checked === true)}
                  />
                </div>

                <Button type="submit" className="w-full h-11 font-medium" disabled={loading}>
                  {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {t.loginButton}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup" className="animate-fade-in">
              <form onSubmit={handleSignup} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-name" className="text-sm font-medium">{t.fullName}</Label>
                  <Input
                    id="signup-name"
                    name="fullName"
                    type="text"
                    placeholder={t.namePlaceholder}
                    required
                    className={cn(
                      "transition-all duration-200",
                      errors.fullName && "border-destructive ring-destructive/20 ring-2"
                    )}
                  />
                  {errors.fullName && (
                    <p className="text-sm text-destructive flex items-center gap-1 animate-fade-in" role="alert">
                      <AlertCircle className="w-3 h-3" /> {errors.fullName}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signup-email" className="text-sm font-medium">{t.email}</Label>
                  <Input
                    id="signup-email"
                    name="email"
                    type="email"
                    placeholder={t.emailPlaceholder}
                    required
                    className={cn(
                      "transition-all duration-200",
                      errors.email && "border-destructive ring-destructive/20 ring-2"
                    )}
                  />
                  {errors.email && (
                    <p className="text-sm text-destructive flex items-center gap-1 animate-fade-in" role="alert">
                      <AlertCircle className="w-3 h-3" /> {errors.email}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signup-password" className="text-sm font-medium">{t.password}</Label>
                  <div className="relative">
                    <Input
                      id="signup-password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      placeholder={t.passwordPlaceholder}
                      required
                      className={cn(
                        "pr-10 transition-all duration-200",
                        errors.password && "border-destructive ring-destructive/20 ring-2"
                      )}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4 text-muted-foreground" />
                      ) : (
                        <Eye className="w-4 h-4 text-muted-foreground" />
                      )}
                    </Button>
                  </div>
                  {errors.password && (
                    <p className="text-sm text-destructive flex items-center gap-1 animate-fade-in" role="alert">
                      <AlertCircle className="w-3 h-3" /> {errors.password}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signup-confirm" className="text-sm font-medium">{t.confirmPassword}</Label>
                  <div className="relative">
                    <Input
                      id="signup-confirm"
                      name="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder={t.passwordPlaceholder}
                      required
                      className={cn(
                        "pr-10 transition-all duration-200",
                        errors.confirmPassword && "border-destructive ring-destructive/20 ring-2"
                      )}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="w-4 h-4 text-muted-foreground" />
                      ) : (
                        <Eye className="w-4 h-4 text-muted-foreground" />
                      )}
                    </Button>
                  </div>
                  {errors.confirmPassword && (
                    <p className="text-sm text-destructive flex items-center gap-1 animate-fade-in" role="alert">
                      <AlertCircle className="w-3 h-3" /> {errors.confirmPassword}
                    </p>
                  )}
                </div>

                <Button type="submit" className="w-full h-11 font-medium" disabled={loading}>
                  {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {t.signupButton}
                </Button>
              </form>
            </TabsContent>
          </Tabs>

          {/* Security footer */}
          <div className="mt-6 pt-4 border-t border-border/50 flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <Shield className="w-3 h-3" />
            <span>{t.secureConnection}</span>
          </div>
        </CardContent>
      </Card>

      {/* Footer */}
      <p className="absolute bottom-4 text-xs text-muted-foreground/60">
        © {new Date().getFullYear()} PrintControl. {t.allRightsReserved}
      </p>
    </div>
  );
}
