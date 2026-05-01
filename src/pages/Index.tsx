import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';

export default function Index() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (user) {
      if (location.pathname !== '/' && location.pathname !== '') return;
      const lastRoute = sessionStorage.getItem('lastRoute');
      navigate(lastRoute || '/dashboard', { replace: true });
    } else {
      navigate('/auth', { replace: true });
    }
  }, [user, loading, navigate, location.pathname]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  );
}
