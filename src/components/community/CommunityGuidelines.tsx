import { Shield, Heart, Target, Users, Lock, MessageSquare } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const guidelines = [
  {
    icon: Heart,
    title: "Seja respeitoso e construtivo",
    description: "Trate todos com respeito. Críticas construtivas são bem-vindas, ataques pessoais não.",
  },
  {
    icon: Target,
    title: "Foque em soluções",
    description: "Ao reportar problemas, tente sugerir soluções. Isso acelera o desenvolvimento.",
  },
  {
    icon: Users,
    title: "Compartilhe conhecimento genuíno",
    description: "Experiências reais ajudam outros usuários. Evite spam ou autopromoção.",
  },
  {
    icon: Lock,
    title: "Respeite a privacidade",
    description: "Não compartilhe dados sensíveis de clientes ou informações confidenciais.",
  },
  {
    icon: MessageSquare,
    title: "Mantenha discussões relevantes",
    description: "Foque em temas relacionados ao NOID, vendas, CRM e tecnologia.",
  },
  {
    icon: Shield,
    title: "Reporte violações",
    description: "Se encontrar conteúdo inadequado, reporte para nossa equipe de moderação.",
  },
];

export function CommunityGuidelines() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          Regras da Comunidade
        </CardTitle>
        <CardDescription>
          Conduta esperada para manter um ambiente saudável e produtivo
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {guidelines.map((guideline, index) => (
            <div 
              key={index} 
              className="flex gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
            >
              <div className="p-2 rounded-md bg-primary/10 h-fit">
                <guideline.icon className="h-4 w-4 text-primary" />
              </div>
              <div>
                <h4 className="font-medium text-sm">{guideline.title}</h4>
                <p className="text-xs text-muted-foreground mt-1">
                  {guideline.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
