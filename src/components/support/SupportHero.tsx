import { Search, Headphones } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { motion } from 'framer-motion';

interface SupportHeroProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
}

export function SupportHero({ searchQuery, onSearchChange }: SupportHeroProps) {
  return (
    <section className="relative py-16 overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-accent/5" />
      
      {/* Decorative elements */}
      <div className="absolute top-10 left-10 w-32 h-32 bg-primary/10 rounded-full blur-3xl" />
      <div className="absolute bottom-10 right-10 w-40 h-40 bg-accent/10 rounded-full blur-3xl" />

      <div className="container relative max-w-4xl mx-auto px-4 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="space-y-6"
        >
          {/* Icon */}
          <div className="inline-flex p-4 rounded-2xl bg-primary/10 text-primary mb-2">
            <Headphones className="h-10 w-10" />
          </div>

          {/* Title */}
          <h1 className="text-4xl md:text-5xl font-bold text-foreground">
            Central de Suporte NOID
          </h1>

          {/* Subtitle */}
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Estamos aqui para garantir sua performance. 
            Encontre respostas rápidas ou fale diretamente com nossa equipe.
          </p>

          {/* Search */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="max-w-xl mx-auto pt-4"
          >
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Buscar na documentação e FAQ..."
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                className="pl-12 pr-4 py-6 text-base rounded-xl border-border/50 bg-background/80 backdrop-blur-sm shadow-sm focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
