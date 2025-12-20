import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Lightbulb, FileText, Activity, Image, Search } from 'lucide-react';
import { Link } from 'react-router-dom';

const tips = [
  {
    icon: Search,
    text: 'Busque na documentação — 80% das dúvidas estão lá',
  },
  {
    icon: Activity,
    text: 'Verifique o status da plataforma antes de reportar',
  },
  {
    icon: FileText,
    text: 'Descreva o problema com o máximo de detalhes',
  },
  {
    icon: Image,
    text: 'Inclua prints ou gravações de tela se possível',
  },
];

const recommendedArticles = [
  { title: 'Como usar o Forecast com IA', slug: 'forecast-ia' },
  { title: 'Entendendo o Scoring de leads', slug: 'scoring-leads' },
  { title: 'Configurando permissões de equipe', slug: 'permissoes' },
];

export function SupportBestPractices() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Lightbulb className="h-5 w-5 text-amber-500" />
          Antes de abrir um chamado...
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Tips */}
        <ul className="space-y-3">
          {tips.map((tip, index) => (
            <li key={index} className="flex items-start gap-3">
              <div className="p-1.5 rounded-md bg-muted">
                <tip.icon className="h-4 w-4 text-muted-foreground" />
              </div>
              <span className="text-sm text-muted-foreground">{tip.text}</span>
            </li>
          ))}
        </ul>

        {/* Recommended Articles */}
        <div>
          <p className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Artigos recomendados
          </p>
          <ul className="space-y-2">
            {recommendedArticles.map((article) => (
              <li key={article.slug}>
                <Link
                  to={`/app/docs/guides/${article.slug}`}
                  className="text-sm text-primary hover:underline"
                >
                  • {article.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
