import { AlertTriangle, RefreshCw, Home, Bug } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';

interface ErrorFallbackProps {
  error: Error | null;
  section?: string;
  onRetry?: () => void;
  onReload?: () => void;
}

export function ErrorFallback({ error, section, onRetry, onReload }: ErrorFallbackProps) {
  const isDev = import.meta.env.DEV;

  return (
    <div className="min-h-[400px] flex items-center justify-center p-4">
      <Card className="w-full max-w-md border-destructive/50">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
            <AlertTriangle className="h-6 w-6 text-destructive" />
          </div>
          <CardTitle className="text-xl">Algo deu errado</CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-3">
          <p className="text-muted-foreground">
            {section 
              ? `Ocorreu um erro ao carregar ${section}.`
              : 'Ocorreu um erro inesperado na aplicação.'}
          </p>
          
          {isDev && error && (
            <div className="mt-4 p-3 bg-muted rounded-lg text-left">
              <div className="flex items-center gap-2 text-sm font-medium text-destructive mb-1">
                <Bug className="h-4 w-4" />
                <span>Debug Info (dev only)</span>
              </div>
              <p className="text-xs font-mono text-muted-foreground break-all">
                {error.message}
              </p>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex flex-col gap-2">
          {onRetry && (
            <Button onClick={onRetry} className="w-full" variant="default">
              <RefreshCw className="mr-2 h-4 w-4" />
              Tentar novamente
            </Button>
          )}
          {onReload && (
            <Button onClick={onReload} variant="outline" className="w-full">
              <RefreshCw className="mr-2 h-4 w-4" />
              Recarregar página
            </Button>
          )}
          <Button
            variant="ghost"
            className="w-full"
            onClick={() => window.location.href = '/app/dashboard'}
          >
            <Home className="mr-2 h-4 w-4" />
            Voltar ao Dashboard
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

// Compact version for inline sections
export function ErrorFallbackCompact({ error, onRetry }: Omit<ErrorFallbackProps, 'section'>) {
  return (
    <div className="flex flex-col items-center justify-center p-6 text-center">
      <AlertTriangle className="h-8 w-8 text-destructive mb-3" />
      <p className="text-sm text-muted-foreground mb-3">
        Erro ao carregar conteúdo
      </p>
      {onRetry && (
        <Button size="sm" variant="outline" onClick={onRetry}>
          <RefreshCw className="mr-2 h-3 w-3" />
          Tentar novamente
        </Button>
      )}
    </div>
  );
}
