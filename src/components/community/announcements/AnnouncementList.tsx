import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Megaphone, Sparkles, Bug, Wrench, AlertCircle, ExternalLink } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { motion } from "framer-motion";

interface ReleaseNote {
  id: string;
  version: string;
  title: string;
  description: string;
  is_major: boolean;
  release_date: string;
  created_at: string;
}

const typeConfig = {
  major: { icon: Sparkles, label: "Versão maior", color: "bg-green-500/10 text-green-600 border-green-500/30" },
  minor: { icon: Wrench, label: "Melhoria", color: "bg-blue-500/10 text-blue-600 border-blue-500/30" },
};

export function AnnouncementList() {
  const { data: releases, isLoading } = useQuery({
    queryKey: ['release-notes-community'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('release_notes')
        .select('*')
        .order('release_date', { ascending: false })
        .limit(10);

      if (error) throw error;
      return data as ReleaseNote[];
    },
    staleTime: 60000,
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
    );
  }

  if (!releases || releases.length === 0) {
    return (
      <Card className="p-8 text-center">
        <Megaphone className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="font-medium text-lg mb-2">Nenhum anúncio ainda</h3>
        <p className="text-muted-foreground">
          Os anúncios oficiais aparecerão aqui.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Anúncios Oficiais</h2>
          <p className="text-muted-foreground">
            Releases, novas funcionalidades e atualizações do NOID
          </p>
        </div>
        <Button variant="outline" asChild>
          <a href="/release-notes" target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-4 w-4 mr-2" />
            Ver todas
          </a>
        </Button>
      </div>

      <div className="space-y-4">
        {releases.map((release, index) => {
          const config = release.is_major ? typeConfig.major : typeConfig.minor;
          const Icon = config.icon;

          return (
            <motion.div
              key={release.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card className="hover:border-primary/30 transition-colors">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${config.color}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <CardTitle className="text-lg flex items-center gap-2">
                          {release.title}
                          <Badge variant="outline" className="text-xs">
                            v{release.version}
                          </Badge>
                        </CardTitle>
                        <CardDescription>
                          {release.release_date && format(
                            new Date(release.release_date),
                            "d 'de' MMMM 'de' yyyy",
                            { locale: ptBR }
                          )}
                        </CardDescription>
                      </div>
                    </div>
                    <Badge variant="outline" className={config.color}>
                      {config.label}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground line-clamp-3">
                    {release.description}
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
