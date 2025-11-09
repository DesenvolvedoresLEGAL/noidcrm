import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useNavigate } from 'react-router-dom';
import { Zap, BarChart3, Bot, TrendingUp } from 'lucide-react';
import { motion } from 'framer-motion';

const Index = () => {
  const navigate = useNavigate();

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
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      {/* Hero Section */}
      <section className="container mx-auto px-4 pt-20 pb-32">
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
              <Zap className="w-9 h-9 text-primary-foreground" />
            </div>
            <span className="text-5xl font-bold">NOID CRM</span>
          </motion.div>

          {/* Headline */}
          <motion.h1
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
              Fazer login
            </Button>
          </motion.div>
        </motion.div>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-4 pb-32">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto"
        >
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.7 + index * 0.1 }}
              >
                <Card className="border-2 hover:border-primary/50 transition-colors h-full">
                  <CardContent className="pt-8 pb-6 text-center">
                    <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
                      <Icon className="w-8 h-8 text-primary" />
                    </div>
                    <h3 className="text-xl font-semibold mb-3">{feature.title}</h3>
                    <p className="text-muted-foreground">{feature.description}</p>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/40 py-8">
        <div className="container mx-auto px-4 text-center text-muted-foreground">
          <p>&copy; 2025 NOID CRM. Todos os direitos reservados.</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
