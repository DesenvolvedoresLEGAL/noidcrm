import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ThemeToggle';
import { LoadingSpinner } from '@/components/LoadingSpinner';

interface SettingsPageWrapperProps {
  title: string;
  description?: string;
  isLoading?: boolean;
  isSaving?: boolean;
  children: React.ReactNode;
}

export function SettingsPageWrapper({ 
  title, 
  description, 
  isLoading, 
  isSaving, 
  children 
}: SettingsPageWrapperProps) {
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex h-14 items-center justify-between">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/app/settings')}
                className="gap-2 text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="h-4 w-4" />
                <span className="hidden sm:inline">Configurações</span>
              </Button>
              <ThemeToggle />
            </div>
          </div>
        </header>
        <main className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-center h-64">
            <LoadingSpinner />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-14 items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/app/settings')}
              className="gap-2 text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Configurações</span>
            </Button>
            <div className="flex items-center gap-2">
              {isSaving && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <LoadingSpinner />
                  <span className="hidden sm:inline">Salvando...</span>
                </div>
              )}
              <ThemeToggle />
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">{title}</h1>
          {description && (
            <p className="text-muted-foreground mt-1">{description}</p>
          )}
        </div>
        {children}
      </main>
    </div>
  );
}
