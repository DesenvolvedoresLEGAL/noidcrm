import { Zap } from 'lucide-react';

export function LandingFooter() {
  return (
    <footer className="py-12 border-t border-border bg-card/50">
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Zap className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-bold">NOID</span>
            <span className="text-xs text-muted-foreground">RevenueOS</span>
          </div>

          {/* Links */}
          <nav className="flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground">
            <a href="#produto" className="hover:text-foreground transition-colors">
              Produto
            </a>
            <a href="#funcionalidades" className="hover:text-foreground transition-colors">
              Funcionalidades
            </a>
            <a href="#pricing" className="hover:text-foreground transition-colors">
              Pricing
            </a>
            <a href="#" className="hover:text-foreground transition-colors">
              Política de Privacidade
            </a>
            <a href="#" className="hover:text-foreground transition-colors">
              Termos de Uso
            </a>
          </nav>

          {/* Copyright */}
          <p className="text-sm text-muted-foreground">
            &copy; 2025 NOID. Todos os direitos reservados.
          </p>
        </div>

        {/* Schema.org Organization */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              "name": "NOID RevenueOS",
              "description": "Sistema Operacional de Receita com Inteligência Artificial para times de vendas",
              "url": "https://noidcrm.com",
              "logo": "https://noidcrm.com/logo.png",
              "sameAs": [],
            }),
          }}
        />

        {/* Schema.org SoftwareApplication */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "SoftwareApplication",
              "name": "NOID RevenueOS",
              "applicationCategory": "BusinessApplication",
              "operatingSystem": "Web",
              "offers": {
                "@type": "Offer",
                "price": "199.90",
                "priceCurrency": "BRL",
                "priceValidUntil": "2025-12-31",
              },
              "aggregateRating": {
                "@type": "AggregateRating",
                "ratingValue": "4.9",
                "ratingCount": "127",
              },
            }),
          }}
        />
      </div>
    </footer>
  );
}
