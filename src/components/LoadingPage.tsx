import { Loader2 } from 'lucide-react';

interface LoadingPageProps {
  message?: string;
  submessage?: string;
}

export function LoadingPage({ message = 'Carregando...', submessage }: LoadingPageProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
        <div className="space-y-1">
          <p className="text-lg font-medium text-foreground">{message}</p>
          {submessage && (
            <p className="text-sm text-muted-foreground">{submessage}</p>
          )}
        </div>
      </div>
    </div>
  );
}

// Compact version for sections
export function LoadingSection({ message = 'Carregando...' }: { message?: string }) {
  return (
    <div className="flex items-center justify-center p-8">
      <div className="text-center space-y-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}
