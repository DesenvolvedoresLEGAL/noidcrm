import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Zap, BarChart3, Bot, TrendingUp } from 'lucide-react';
import { motion } from 'framer-motion';
import { useTranslation } from '@/hooks/useTranslation';
import { CRMStructuredData } from '@/components/SEOStructuredData';

const Index = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const features = [
    {
      icon: BarChart3,
      title: 'Pipeline Visual',
      description: 'Gerencie suas oportunidades com quadros Kanban intuitivos',
    },
    {
      icon: Bot,
      title: 'Automação Inteligente',
      description: 'Automatize tarefas repetitivas e foque no que importa',
    },
    {
      icon: TrendingUp,
      title: 'Relatórios em Tempo Real',
      description: 'Insights instantâneos para decisões mais rápidas',
    },
  ];

  return (
    <>
      <Helmet>
        <title>{t('common.appName')} - CRM Inteligente para Equipes de Vendas</title>
        <meta name="description" content="NOID CRM é o sistema de gestão comercial inteligente com automação, relatórios e insights para impulsionar suas vendas. Comece grátis!" />
        <meta name="keywords" content="CRM, vendas, pipeline, automação, gestão comercial, relatórios, AI" />
        <link rel="canonical" href="https://noidcrm.com" />
        
        {/* Open Graph */}
        <meta property="og:title" content="NOID CRM - CRM Inteligente para Equipes de Vendas" />
        <meta property="og:description" content="Sistema de gestão comercial com automação, relatórios e insights para impulsionar suas vendas." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://noidcrm.com" />
        
        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="NOID CRM - CRM Inteligente" />
        <meta name="twitter:description" content="Sistema de gestão comercial com automação e insights." />
      </Helmet>
      
      <CRMStructuredData />

      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
        {/* Hero Section */}
        <section className="container mx-auto px-4 pt-20 pb-32" aria-labelledby="hero-title">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center max-w-4xl mx-auto"
          >
            {/* Logo */}
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="flex items-center justify-center gap-3 mb-8"
            >
              <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center">
                <Zap className="w-9 h-9 text-primary-foreground" aria-hidden="true" />
              </div>
              <span className="text-5xl font-bold">{t('common.appName')}</span>
            </motion.div>

            {/* Headline */}
            <motion.h1
              id="hero-title"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="text-5xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent"
            >
              Gerencie seu pipeline de vendas com inteligência
            </motion.h1>

            {/* Subheadline */}
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="text-xl md:text-2xl text-muted-foreground mb-12"
            >
              CRM completo com automação, relatórios e insights para impulsionar suas vendas
            </motion.p>

            {/* CTAs */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.5 }}
              className="flex flex-col sm:flex-row gap-4 justify-center"
            >
              <Button
                size="lg"
                className="text-lg px-8 py-6 shadow-lg hover:shadow-xl transition-shadow"
                onClick={() => navigate('/signup')}
              >
                Começar agora
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="text-lg px-8 py-6"
                onClick={() => navigate('/login')}
              >
                {t('auth.login')}
              </Button>
            </motion.div>
          </motion.div>
        </section>

        {/* Features Section */}
        <section className="container mx-auto px-4 pb-32" aria-labelledby="features-title">
          <h2 id="features-title" className="sr-only">Recursos do NOID CRM</h2>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.6 }}
            className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto"
          >
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <motion.article
                  key={feature.title}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.7 + index * 0.1 }}
                >
                  <Card className="border-2 hover:border-primary/50 transition-colors h-full">
                    <CardContent className="pt-8 pb-6 text-center">
                      <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
                        <Icon className="w-8 h-8 text-primary" aria-hidden="true" />
                      </div>
                      <h3 className="text-xl font-semibold mb-3">{feature.title}</h3>
                      <p className="text-muted-foreground">{feature.description}</p>
                    </CardContent>
                  </Card>
                </motion.article>
              );
            })}
          </motion.div>
        </section>

        {/* Footer */}
        <footer className="border-t border-border/40 py-8" role="contentinfo">
          <div className="container mx-auto px-4 text-center text-muted-foreground">
            <p>&copy; 2025 {t('common.appName')}. Todos os direitos reservados.</p>
          </div>
        </footer>
      </div>
    </>
  );
};

export default Index;
