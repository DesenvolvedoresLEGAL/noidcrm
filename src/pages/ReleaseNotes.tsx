import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Search, Sparkles, Bug, Wrench, Shield, Zap } from 'lucide-react';

interface ChangeItem {
  type: string;
  description: string;
}

interface ReleaseNote {
  id: string;
  version: string;
  title: string;
  description: string | null;
  release_date: string;
  changes: ChangeItem[];
  is_major: boolean;
  created_at: string;
}

const typeConfig: Record<string, { label: string; icon: typeof Sparkles; color: string }> = {
  feature: { label: 'Novidade', icon: Sparkles, color: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' },
  fix: { label: 'Correção', icon: Bug, color: 'bg-red-500/10 text-red-600 border-red-500/20' },
  improvement: { label: 'Melhoria', icon: Zap, color: 'bg-blue-500/10 text-blue-600 border-blue-500/20' },
  security: { label: 'Segurança', icon: Shield, color: 'bg-amber-500/10 text-amber-600 border-amber-500/20' },
};

export default function ReleaseNotes() {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<string>('all');

  const { data: releases = [], isLoading } = useQuery({
    queryKey: ['release-notes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('release_notes')
        .select('*')
        .order('release_date', { ascending: false });
      
      if (error) throw error;
      return (data || []).map(item => ({
        ...item,
        changes: (item.changes as unknown as ChangeItem[]) || [],
      })) as ReleaseNote[];
    },
  });

  const filteredReleases = releases.filter(release => {
    const matchesSearch = !search || 
      release.title.toLowerCase().includes(search.toLowerCase()) ||
      release.description?.toLowerCase().includes(search.toLowerCase()) ||
      release.version.includes(search);
    
    const matchesFilter = filter === 'all' || 
      (filter === 'major' && release.is_major) ||
      release.changes.some(c => c.type === filter);
    
    return matchesSearch && matchesFilter;
  });

  return (
    <Layout>
      <div className="container max-w-4xl mx-auto py-8 px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Release Notes</h1>
          <p className="text-muted-foreground mt-2">
            Acompanhe todas as novidades, melhorias e correções do NOID CRM
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-8">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por versão ou funcionalidade..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Tabs value={filter} onValueChange={setFilter}>
            <TabsList>
              <TabsTrigger value="all">Todos</TabsTrigger>
              <TabsTrigger value="major">Major</TabsTrigger>
              <TabsTrigger value="feature">Novidades</TabsTrigger>
              <TabsTrigger value="fix">Correções</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Timeline */}
        <ScrollArea className="h-[calc(100vh-300px)]">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
            </div>
          ) : filteredReleases.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              Nenhuma release encontrada
            </div>
          ) : (
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-[19px] top-0 bottom-0 w-px bg-border" />
              
              <div className="space-y-6">
                {filteredReleases.map((release, index) => (
                  <div key={release.id} className="relative pl-12">
                    {/* Timeline dot */}
                    <div className={`absolute left-0 w-10 h-10 rounded-full border-4 flex items-center justify-center ${
                      release.is_major 
                        ? 'bg-primary border-primary text-primary-foreground' 
                        : 'bg-background border-muted-foreground/20'
                    }`}>
                      {release.is_major ? (
                        <Sparkles className="h-4 w-4" />
                      ) : (
                        <Wrench className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>

                    <Card className={release.is_major ? 'border-primary/50 shadow-lg' : ''}>
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant={release.is_major ? 'default' : 'secondary'}>
                                v{release.version}
                              </Badge>
                              {release.is_major && (
                                <Badge variant="outline" className="bg-primary/5">
                                  Major Release
                                </Badge>
                              )}
                            </div>
                            <CardTitle className="text-xl">{release.title}</CardTitle>
                            {release.description && (
                              <CardDescription className="mt-1">
                                {release.description}
                              </CardDescription>
                            )}
                          </div>
                          <time className="text-sm text-muted-foreground whitespace-nowrap">
                            {format(new Date(release.release_date), "dd MMM yyyy", { locale: ptBR })}
                          </time>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <ul className="space-y-2">
                          {release.changes.map((change, idx) => {
                            const config = typeConfig[change.type] || typeConfig.improvement;
                            const Icon = config.icon;
                            return (
                              <li key={idx} className="flex items-start gap-3">
                                <Badge variant="outline" className={`${config.color} shrink-0 mt-0.5`}>
                                  <Icon className="h-3 w-3 mr-1" />
                                  {config.label}
                                </Badge>
                                <span className="text-sm">{change.description}</span>
                              </li>
                            );
                          })}
                        </ul>
                      </CardContent>
                    </Card>
                  </div>
                ))}
              </div>
            </div>
          )}
        </ScrollArea>
      </div>
    </Layout>
  );
}
