import { useState, useMemo, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Search, Sparkles, Bug, Wrench, Shield, Zap, Package, Calendar, TrendingUp, Star, ArrowUpDown, ArrowUp, ArrowDown, FileEdit } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePlatformAdmin } from '@/hooks/usePlatformAdmin';
import { GenerateReleaseDraftButton } from '@/components/admin/release-notes/GenerateReleaseDraftButton';
import { DraftsTab } from '@/components/admin/release-notes/DraftsTab';
import { useReleaseDrafts } from '@/hooks/useReleaseNotesAdmin';
import { TabsContent } from '@/components/ui/tabs';


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

// Semantic version comparison: properly sorts 1.2.0 before 1.10.0
const compareVersions = (a: string, b: string): number => {
  const partsA = a.split('.').map(Number);
  const partsB = b.split('.').map(Number);
  
  for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
    const numA = partsA[i] || 0;
    const numB = partsB[i] || 0;
    if (numA !== numB) return numA - numB;
  }
  return 0;
};

export default function ReleaseNotes() {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<string>('all');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc'); // asc = oldest first, desc = newest first
  const timelineRef = useRef<HTMLDivElement>(null);

  const { isSuperAdmin, isPlatformAdmin } = usePlatformAdmin();
  const canManageDrafts = isPlatformAdmin || isSuperAdmin;
  const [activeView, setActiveView] = useState<'published' | 'drafts'>('published');
  const { data: drafts = [] } = useReleaseDrafts();

  const { data: releases = [], isLoading } = useQuery({
    queryKey: ['release-notes', 'published'],
    queryFn: async () => {
      // Use the public view that filters out drafts/discarded server-side
      const { data, error } = await supabase
        .from('v_release_notes_public' as any)
        .select('*');
      
      if (error) throw error;
      
      // Sort by semantic version (oldest first: 1.0.0 -> 1.24.0)
      const sorted = ((data as any[]) || []).sort((a, b) => compareVersions(a.version, b.version));
      
      return sorted.map((item: any) => ({
        ...item,
        changes: (item.changes as unknown as ChangeItem[]) || [],
      })) as ReleaseNote[];
    },
  });


  // Auto-scroll to latest version on load
  useEffect(() => {
    if (!isLoading && releases.length > 0) {
      const latestVersion = releases[releases.length - 1]?.version;
      if (latestVersion) {
        setTimeout(() => {
          const element = document.getElementById(`release-${latestVersion}`);
          element?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
      }
    }
  }, [isLoading, releases]);

  // Calculate statistics
  const stats = useMemo(() => {
    const totalVersions = releases.length;
    const majorReleases = releases.filter(r => r.is_major).length;
    const minorReleases = totalVersions - majorReleases;
    const totalChanges = releases.reduce((acc, r) => acc + r.changes.length, 0);
    const lastUpdate = releases[releases.length - 1]?.release_date;
    
    return { totalVersions, majorReleases, minorReleases, totalChanges, lastUpdate };
  }, [releases]);

  const filteredReleases = useMemo(() => {
    const filtered = releases.filter(release => {
      const matchesSearch = !search || 
        release.title.toLowerCase().includes(search.toLowerCase()) ||
        release.description?.toLowerCase().includes(search.toLowerCase()) ||
        release.version.includes(search);
      
      const matchesFilter = filter === 'all' || 
        (filter === 'major' && release.is_major) ||
        release.changes.some(c => c.type === filter);
      
      return matchesSearch && matchesFilter;
    });
    
    // Apply sort order
    return sortOrder === 'desc' ? [...filtered].reverse() : filtered;
  }, [releases, search, filter, sortOrder]);

  // Sidebar always shows in semantic order (oldest first)
  const sidebarReleases = useMemo(() => {
    return sortOrder === 'desc' ? [...releases].reverse() : releases;
  }, [releases, sortOrder]);

  return (
    <Layout>
      <div className="flex-1 p-4 md:p-6 space-y-4 md:space-y-6">
        {/* Header Section */}
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Package className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Release Notes</h1>
                <p className="text-muted-foreground">
                  Acompanhe toda a evolução do NOID CRM
                </p>
              </div>
            </div>
            {canManageDrafts && (
              <div className="flex items-center gap-2 pt-2">
                <Tabs value={activeView} onValueChange={(v) => setActiveView(v as 'published' | 'drafts')}>
                  <TabsList className="bg-card/50">
                    <TabsTrigger value="published">Publicadas</TabsTrigger>
                    <TabsTrigger value="drafts" className="gap-2">
                      <FileEdit className="h-3.5 w-3.5" />
                      Rascunhos
                      {drafts.length > 0 && (
                        <Badge variant="secondary" className="h-5 px-1.5 text-xs">{drafts.length}</Badge>
                      )}
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
                <GenerateReleaseDraftButton />
              </div>
            )}
          </div>

          
          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="bg-card/50 backdrop-blur border-border/50">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Package className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats.totalVersions}</p>
                    <p className="text-xs text-muted-foreground">Versões</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-card/50 backdrop-blur border-border/50">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-amber-500/10">
                    <Star className="h-4 w-4 text-amber-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats.majorReleases}</p>
                    <p className="text-xs text-muted-foreground">Major</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-card/50 backdrop-blur border-border/50">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-emerald-500/10">
                    <TrendingUp className="h-4 w-4 text-emerald-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats.minorReleases}</p>
                    <p className="text-xs text-muted-foreground">Minor</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-card/50 backdrop-blur border-border/50">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-500/10">
                    <Sparkles className="h-4 w-4 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats.totalChanges}</p>
                    <p className="text-xs text-muted-foreground">Changes</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {canManageDrafts && activeView === 'drafts' ? (
          <DraftsTab />
        ) : (
        <>
        {/* Filters Section */}

        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por versão ou funcionalidade..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-card/50"
            />
          </div>
          <div className="flex items-center gap-2">
            <Tabs value={filter} onValueChange={setFilter}>
              <TabsList className="bg-card/50">
                <TabsTrigger value="all">Todos</TabsTrigger>
                <TabsTrigger value="major">Major</TabsTrigger>
                <TabsTrigger value="feature">Novidades</TabsTrigger>
                <TabsTrigger value="improvement">Melhorias</TabsTrigger>
                <TabsTrigger value="fix">Correções</TabsTrigger>
                <TabsTrigger value="security">Segurança</TabsTrigger>
              </TabsList>
            </Tabs>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
              className="bg-card/50 gap-2"
            >
              {sortOrder === 'asc' ? (
                <>
                  <ArrowUp className="h-4 w-4" />
                  <span className="hidden sm:inline">Mais antigas</span>
                </>
              ) : (
                <>
                  <ArrowDown className="h-4 w-4" />
                  <span className="hidden sm:inline">Mais novas</span>
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Timeline Content */}
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
          {/* Version Navigation Sidebar */}
          <Card className="xl:col-span-1 bg-card/50 backdrop-blur border-border/50 h-fit xl:sticky xl:top-6">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Versões
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[300px] xl:h-[500px]">
                <div className="px-4 pb-4 space-y-1">
                  {sidebarReleases.map((release) => (
                    <button
                      key={release.id}
                      onClick={() => {
                        const element = document.getElementById(`release-${release.version}`);
                        element?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      }}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors hover:bg-accent ${
                        release.is_major ? 'font-medium' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-2">
                          {release.is_major && <Star className="h-3 w-3 text-amber-500" />}
                          v{release.version}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {format(parseISO(release.release_date), "MMM yy", { locale: ptBR })}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Main Timeline */}
          <div className="xl:col-span-3">
            <ScrollArea className="h-[calc(100vh-320px)]">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
                </div>
              ) : filteredReleases.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  Nenhuma release encontrada
                </div>
              ) : (
                <div className="relative pl-8">
                  {/* Timeline line */}
                  <div className="absolute left-3 top-0 bottom-0 w-px bg-gradient-to-b from-primary/50 via-border to-border" />
                  
                  <div className="space-y-6">
                    {filteredReleases.map((release) => (
                      <div 
                        key={release.id} 
                        id={`release-${release.version}`}
                        className="relative scroll-mt-6"
                      >
                        {/* Timeline dot */}
                        <div className={`absolute -left-5 w-4 h-4 rounded-full border-2 ${
                          release.is_major 
                            ? 'bg-primary border-primary shadow-lg shadow-primary/30' 
                            : 'bg-background border-muted-foreground/30'
                        }`} />

                        <Card className={`transition-all duration-200 hover:shadow-lg ${
                          release.is_major 
                            ? 'border-primary/30 bg-gradient-to-br from-primary/5 to-transparent shadow-md' 
                            : 'bg-card/50 backdrop-blur border-border/50'
                        }`}>
                          <CardHeader className="pb-3">
                            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                              <div className="space-y-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <Badge 
                                    variant={release.is_major ? 'default' : 'secondary'}
                                    className={release.is_major ? 'bg-primary' : ''}
                                  >
                                    v{release.version}
                                  </Badge>
                                  {release.is_major && (
                                    <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20">
                                      <Star className="h-3 w-3 mr-1" />
                                      Major Release
                                    </Badge>
                                  )}
                                  <Badge variant="outline" className="text-xs">
                                    {release.changes.length} alterações
                                  </Badge>
                                </div>
                                <CardTitle className="text-lg">{release.title}</CardTitle>
                                {release.description && (
                                  <CardDescription className="text-sm">
                                    {release.description}
                                  </CardDescription>
                                )}
                              </div>
                              <time className="text-sm text-muted-foreground whitespace-nowrap flex items-center gap-1.5">
                                <Calendar className="h-3.5 w-3.5" />
                                {format(parseISO(release.release_date), "dd MMM yyyy", { locale: ptBR })}
                              </time>
                            </div>
                          </CardHeader>
                          <CardContent>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                              {release.changes.map((change, idx) => {
                                const config = typeConfig[change.type] || typeConfig.improvement;
                                const Icon = config.icon;
                                return (
                                  <div 
                                    key={idx} 
                                    className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                                  >
                                    <Badge variant="outline" className={`${config.color} shrink-0 mt-0.5`}>
                                      <Icon className="h-3 w-3 mr-1" />
                                      {config.label}
                                    </Badge>
                                    <span className="text-sm leading-relaxed">{change.description}</span>
                                  </div>
                                );
                              })}
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </ScrollArea>
          </div>
        </div>
      </div>
    </Layout>
  );
}
