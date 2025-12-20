import { MessageCircle, Mail, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export function DocsSupportCTA() {
  return (
    <section className="py-12">
      <div className="container max-w-4xl mx-auto px-4">
        <Card className="bg-gradient-to-br from-primary/5 via-background to-accent/5 border-primary/20">
          <CardContent className="p-8 text-center">
            <div className="inline-flex p-4 rounded-2xl bg-primary/10 text-primary mb-6">
              <MessageCircle className="h-8 w-8" />
            </div>
            
            <h2 className="text-2xl font-bold text-foreground mb-3">
              Não encontrou o que procura?
            </h2>
            <p className="text-muted-foreground mb-6 max-w-lg mx-auto">
              Nossa equipe de suporte está pronta para ajudar você a aproveitar ao máximo o NOID RevenueOS.
            </p>

            <div className="flex items-center justify-center gap-4 flex-wrap">
              <Button className="gap-2">
                <Mail className="h-4 w-4" />
                Enviar email para suporte
              </Button>
              <Button variant="outline" className="gap-2">
                <ExternalLink className="h-4 w-4" />
                Agendar demonstração
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
