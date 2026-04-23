import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface FetchErrorStateProps {
  error: string;
  onRetry: () => void | Promise<void>;
}

export function FetchErrorState({ error, onRetry }: FetchErrorStateProps) {
  return (
    <div className="flex flex-col items-center py-16 gap-4 text-destructive">
      <AlertTriangle className="w-12 h-12 opacity-70" />
      <p className="font-medium text-center">{error}</p>
      <Button variant="outline" onClick={onRetry} className="gap-2">
        <RefreshCw className="w-4 h-4" />
        Reintentar
      </Button>
    </div>
  );
}