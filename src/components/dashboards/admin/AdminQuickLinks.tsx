import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Shield, GitBranch, Workflow, FileText, ExternalLink } from "lucide-react";
import { useNavigate } from "react-router-dom";

export function AdminQuickLinks() {
  const navigate = useNavigate();

  const links = [
    {
      icon: Shield,
      title: "Controle de Permissões (RBAC)",
      description: "Gerenciar roles e acessos",
      path: "/app/settings/team",
      color: "text-blue-500"
    },
    {
      icon: GitBranch,
      title: "Editor de Pipelines",
      description: "Configurar funis de vendas",
      path: "/app/settings/pipelines",
      color: "text-green-500"
    },
    {
      icon: Workflow,
      title: "Editor de Automações",
      description: "Criar e gerenciar workflows",
      path: "/app/settings/workflows",
      color: "text-purple-500"
    },
    {
      icon: FileText,
      title: "Logs do Sistema",
      description: "Visualizar operações detalhadas",
      path: "/app/settings/audit",
      color: "text-orange-500"
    }
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Acesso Rápido</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {links.map((link, i) => (
            <Button
              key={i}
              variant="outline"
              className="h-auto p-4 flex flex-col items-start gap-2 hover:bg-muted/50"
              onClick={() => navigate(link.path)}
            >
              <div className="flex items-center gap-2 w-full">
                <link.icon className={`h-5 w-5 ${link.color}`} />
                <ExternalLink className="h-3 w-3 ml-auto text-muted-foreground" />
              </div>
              <div className="text-left">
                <p className="text-sm font-medium">{link.title}</p>
                <p className="text-xs text-muted-foreground">{link.description}</p>
              </div>
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
