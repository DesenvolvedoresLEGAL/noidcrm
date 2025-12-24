import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface PageContainerProps {
  children: ReactNode;
  className?: string;
  fullHeight?: boolean;
}

export function PageContainer({ children, className, fullHeight }: PageContainerProps) {
  return (
    <div className={cn(
      // Mobile first - padding menor em mobile
      "p-4 space-y-4",
      // Tablet/Desktop - padding maior
      "md:p-6 md:space-y-6",
      // Altura total opcional
      fullHeight && "min-h-[calc(100vh-4rem)]",
      className
    )}>
      {children}
    </div>
  );
}
