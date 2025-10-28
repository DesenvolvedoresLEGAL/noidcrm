import React, { ReactNode } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface SettingCardProps {
  title?: string;
  description?: string;
  children: ReactNode;
  className?: string;
}

export function SettingCard({ title, description, children, className }: SettingCardProps) {
  return (
    <Card className={className}>
      {(title || description) && (
        <CardHeader>
          {title && <CardTitle className="text-lg">{title}</CardTitle>}
          {description && <CardDescription>{description}</CardDescription>}
        </CardHeader>
      )}
      <CardContent className={!title && !description ? 'pt-6' : ''}>
        {children}
      </CardContent>
    </Card>
  );
}
