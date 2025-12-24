import { useState } from 'react';
import { motion } from 'framer-motion';
import { Helmet } from 'react-helmet-async';
import { Sparkles, BarChart3, Bell, BookOpen, Settings2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DailyVibeCheckWidget } from '@/components/vibe/DailyVibeCheckWidget';
import { VibeAnalyticsDashboard } from '@/components/vibe/VibeAnalyticsDashboard';
import { VibeAlertsListCard } from '@/components/vibe/VibeAlertsListCard';
import { VibeNarrativesLibrary } from '@/components/vibe/VibeNarrativesLibrary';
import { VibeQuickStats } from '@/components/vibe/VibeQuickStats';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Layout } from '@/components/Layout';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } }
};

export default function VibeSelling() {
  const [activeTab, setActiveTab] = useState('overview');

  return (
    <Layout pageTitle="Vibe Selling">
      <Helmet>
        <title>Vibe Selling | Inteligência Emocional em Vendas</title>
        <meta name="description" content="Venda com inteligência emocional e timing perfeito. Identifique o estado emocional de cada lead e use a narrativa certa no momento certo." />
      </Helmet>

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="space-y-6 p-6"
      >
        {/* Header */}
        <motion.div variants={itemVariants} className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5">
              <Sparkles className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Vibe Selling</h1>
              <p className="text-muted-foreground">
                Venda com inteligência emocional e timing perfeito
              </p>
            </div>
          </div>
        </motion.div>

        {/* Tabs Navigation */}
        <motion.div variants={itemVariants}>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-5 lg:w-auto lg:inline-grid">
              <TabsTrigger value="overview" className="gap-2">
                <Sparkles className="h-4 w-4" />
                <span className="hidden sm:inline">Visão Geral</span>
              </TabsTrigger>
              <TabsTrigger value="analytics" className="gap-2">
                <BarChart3 className="h-4 w-4" />
                <span className="hidden sm:inline">Analytics</span>
              </TabsTrigger>
              <TabsTrigger value="alerts" className="gap-2">
                <Bell className="h-4 w-4" />
                <span className="hidden sm:inline">Alertas</span>
              </TabsTrigger>
              <TabsTrigger value="narratives" className="gap-2">
                <BookOpen className="h-4 w-4" />
                <span className="hidden sm:inline">Narrativas</span>
              </TabsTrigger>
              <TabsTrigger value="settings" className="gap-2">
                <Settings2 className="h-4 w-4" />
                <span className="hidden sm:inline">Config</span>
              </TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-6 mt-6">
              <div className="grid lg:grid-cols-3 gap-6">
                {/* Daily Vibe Check - 2 cols */}
                <div className="lg:col-span-2">
                  <DailyVibeCheckWidget />
                </div>
                
                {/* Quick Stats */}
                <div>
                  <VibeQuickStats />
                </div>
              </div>

              {/* What is Vibe Selling */}
              <Card className="border-dashed bg-muted/30">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-primary" />
                    O que é Vibe Selling?
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-muted-foreground">
                    Vibe Selling é uma metodologia que combina inteligência emocional com dados 
                    para identificar o estado emocional de cada lead e sugerir a narrativa mais 
                    efetiva para cada momento da jornada de compra.
                  </p>
                  <div className="grid sm:grid-cols-3 gap-4">
                    <div className="p-4 rounded-lg bg-background border">
                      <h4 className="font-medium mb-1">🎯 Timing Perfeito</h4>
                      <p className="text-sm text-muted-foreground">
                        Saiba quando abordar cada lead
                      </p>
                    </div>
                    <div className="p-4 rounded-lg bg-background border">
                      <h4 className="font-medium mb-1">💬 Narrativas Certas</h4>
                      <p className="text-sm text-muted-foreground">
                        Mensagens personalizadas por estado emocional
                      </p>
                    </div>
                    <div className="p-4 rounded-lg bg-background border">
                      <h4 className="font-medium mb-1">📊 Insights de Vibe</h4>
                      <p className="text-sm text-muted-foreground">
                        Métricas de engajamento emocional
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Analytics Tab */}
            <TabsContent value="analytics" className="mt-6">
              <VibeAnalyticsDashboard />
            </TabsContent>

            {/* Alerts Tab */}
            <TabsContent value="alerts" className="mt-6">
              <VibeAlertsListCard />
            </TabsContent>

            {/* Narratives Tab */}
            <TabsContent value="narratives" className="mt-6">
              <VibeNarrativesLibrary />
            </TabsContent>

            {/* Settings Tab */}
            <TabsContent value="settings" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>Configurações de Vibe Selling</CardTitle>
                  <CardDescription>
                    Configure suas preferências de alertas e notificações
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-8 text-center text-muted-foreground">
                    <Settings2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Configurações em breve.</p>
                    <p className="text-sm">
                      Aqui você poderá ajustar alertas, frequência de notificações 
                      e personalizar narrativas.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </motion.div>
      </motion.div>
    </Layout>
  );
}
