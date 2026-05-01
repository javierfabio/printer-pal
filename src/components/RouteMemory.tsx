import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export function RouteMemory() {
  const location = useLocation();

  useEffect(() => {
    if (location.pathname.startsWith('/dashboard')) {
      sessionStorage.setItem(
        'lastRoute',
        location.pathname + location.search + location.hash
      );
    }
  }, [location]);

  return null;
}