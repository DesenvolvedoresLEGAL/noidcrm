import { Construction } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface AdminPlaceholderProps {
  title: string;
  description?: string;
}

export default function AdminPlaceholder({ title, description }: AdminPlaceholderProps) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {description && (
          <p className="text-muted-foreground">{description}</p>
        )}
      </div>

      <Card>
        <CardContent className="py-16">
          <div className="text-center">
            <Construction className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Em Desenvolvimento</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Este módulo está sendo desenvolvido. Em breve você terá acesso completo 
              a todas as funcionalidades de {title.toLowerCase()}.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
