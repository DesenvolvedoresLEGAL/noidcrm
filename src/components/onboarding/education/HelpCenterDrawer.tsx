import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  HelpCircle, 
  X, 
  Search, 
  Book, 
  Video, 
  MessageCircle,
  ChevronRight,
  ExternalLink
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useHelpArticles, HelpArticle } from '@/hooks/useHelpArticles';
import { cn } from '@/lib/utils';

interface HelpCenterDrawerProps {
  defaultOpen?: boolean;
}

export function HelpCenterDrawer({ defaultOpen = false }: HelpCenterDrawerProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedArticle, setSelectedArticle] = useState<HelpArticle | null>(null);
  
  const { articles, loading, searchArticles, categories } = useHelpArticles();

  const filteredArticles = searchQuery ? searchArticles(searchQuery) : articles;

  const categoryLabels: Record<string, string> = {
    pipeline: '📊 Pipeline',
    equipe: '👥 Equipe',
    propostas: '📄 Propostas',
    metas: '🎯 Metas',
    forecast: '🔮 Forecast',
    insights: '🧠 Insights',
    automacao: '⚡ Automação',
  };

  return (
    <>
      {/* Floating Button */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        className="fixed bottom-4 right-4 z-40"
      >
        <Button
          onClick={() => setIsOpen(true)}
          size="icon"
          className="h-12 w-12 rounded-full shadow-lg"
          variant="outline"
        >
          <HelpCircle className="h-5 w-5" />
        </Button>
      </motion.div>

      {/* Drawer */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-background/50 backdrop-blur-sm"
              onClick={() => {
                setIsOpen(false);
                setSelectedArticle(null);
              }}
            />

            {/* Drawer Panel */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed right-0 top-0 z-50 h-full w-full max-w-md bg-card border-l shadow-xl"
            >
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b">
                <div className="flex items-center gap-2">
                  <HelpCircle className="h-5 w-5 text-primary" />
                  <h2 className="font-semibold">Central de Ajuda</h2>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setIsOpen(false);
                    setSelectedArticle(null);
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {/* Content */}
              <ScrollArea className="h-[calc(100vh-65px)]">
                {selectedArticle ? (
                  // Article View
                  <div className="p-4">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedArticle(null)}
                      className="mb-4"
                    >
                      ← Voltar
                    </Button>

                    <h3 className="text-lg font-semibold mb-2">
                      {selectedArticle.title}
                    </h3>
                    
                    <span className="inline-block px-2 py-1 text-xs rounded-full bg-muted mb-4">
                      {categoryLabels[selectedArticle.category] || selectedArticle.category}
                    </span>

                    <p className="text-muted-foreground whitespace-pre-wrap">
                      {selectedArticle.content}
                    </p>

                    {selectedArticle.videoUrl && (
                      <Button
                        variant="outline"
                        className="mt-4 w-full"
                        onClick={() => window.open(selectedArticle.videoUrl!, '_blank')}
                      >
                        <Video className="mr-2 h-4 w-4" />
                        Assistir vídeo tutorial
                        <ExternalLink className="ml-2 h-3 w-3" />
                      </Button>
                    )}
                  </div>
                ) : (
                  // List View
                  <div className="p-4 space-y-6">
                    {/* Search */}
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Buscar ajuda..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10"
                      />
                    </div>

                    {/* Quick Links */}
                    <div>
                      <h4 className="text-sm font-medium text-muted-foreground mb-3">
                        📚 Guias Rápidos
                      </h4>
                      <div className="space-y-1">
                        {filteredArticles.slice(0, 5).map((article) => (
                          <button
                            key={article.id}
                            onClick={() => setSelectedArticle(article)}
                            className={cn(
                              "w-full flex items-center justify-between p-3 rounded-lg",
                              "text-left hover:bg-muted/50 transition-colors"
                            )}
                          >
                            <div className="flex items-center gap-3">
                              <Book className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm">{article.title}</span>
                            </div>
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          </button>
                        ))}
                      </div>
                    </div>

                    <Separator />

                    {/* Categories */}
                    <div>
                      <h4 className="text-sm font-medium text-muted-foreground mb-3">
                        📂 Categorias
                      </h4>
                      <div className="grid grid-cols-2 gap-2">
                        {categories.map((category) => (
                          <button
                            key={category}
                            onClick={() => setSearchQuery(category)}
                            className={cn(
                              "p-3 rounded-lg border text-left",
                              "hover:bg-muted/50 transition-colors"
                            )}
                          >
                            <span className="text-sm font-medium">
                              {categoryLabels[category] || category}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <Separator />

                    {/* Contact Support */}
                    <div className="p-4 rounded-lg bg-muted/50">
                      <div className="flex items-center gap-3 mb-2">
                        <MessageCircle className="h-5 w-5 text-primary" />
                        <h4 className="font-medium">Precisa de mais ajuda?</h4>
                      </div>
                      <p className="text-sm text-muted-foreground mb-3">
                        Nossa equipe está pronta para ajudar você.
                      </p>
                      <Button variant="outline" size="sm" className="w-full">
                        Falar com suporte
                      </Button>
                    </div>
                  </div>
                )}
              </ScrollArea>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
