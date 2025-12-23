import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  Shield, 
  AlertTriangle, 
  Search, 
  RefreshCw,
  Ban,
  CheckCircle,
  XCircle,
  Globe,
  Mail,
  Fingerprint,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function FraudTab() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('fingerprints');

  // Fetch fingerprints
  const { data: fingerprints, isLoading: fingerprintsLoading, refetch: refetchFingerprints } = useQuery({
    queryKey: ['admin-fingerprints'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('trial_fingerprints')
        .select('*, organizations(name)')
        .order('created_at', { ascending: false })
        .limit(100);
      
      if (error) throw error;
      return data;
    },
  });

  // Fetch IP attempts
  const { data: ipAttempts, isLoading: ipLoading, refetch: refetchIp } = useQuery({
    queryKey: ['admin-ip-attempts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ip_trial_attempts')
        .select('*')
        .order('attempted_at', { ascending: false })
        .limit(100);
      
      if (error) throw error;
      return data;
    },
  });

  // Fetch disposable domains
  const { data: disposableDomains, isLoading: domainsLoading } = useQuery({
    queryKey: ['admin-disposable-domains'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('disposable_email_domains')
        .select('*')
        .order('added_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  // Stats
  const highRiskCount = fingerprints?.filter(f => f.risk_level === 'high' || f.risk_level === 'blocked').length || 0;
  const blockedAttempts = ipAttempts?.filter(a => a.was_blocked).length || 0;
  const totalFingerprints = fingerprints?.length || 0;

  const getRiskBadge = (level: string) => {
    switch (level) {
      case 'blocked':
        return <Badge variant="destructive">Bloqueado</Badge>;
      case 'high':
        return <Badge className="bg-orange-500">Alto Risco</Badge>;
      case 'medium':
        return <Badge className="bg-amber-500">Médio</Badge>;
      default:
        return <Badge variant="secondary">Baixo</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-primary/10">
                <Fingerprint className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalFingerprints}</p>
                <p className="text-sm text-muted-foreground">Fingerprints</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-destructive/10">
                <AlertTriangle className="w-6 h-6 text-destructive" />
              </div>
              <div>
                <p className="text-2xl font-bold">{highRiskCount}</p>
                <p className="text-sm text-muted-foreground">Alto Risco</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-amber-500/10">
                <Ban className="w-6 h-6 text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{blockedAttempts}</p>
                <p className="text-sm text-muted-foreground">Bloqueados</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-green-500/10">
                <Mail className="w-6 h-6 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{disposableDomains?.length || 0}</p>
                <p className="text-sm text-muted-foreground">Domínios Bloqueados</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Refresh */}
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por email, IP ou hash..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button 
          variant="outline" 
          onClick={() => {
            refetchFingerprints();
            refetchIp();
          }}
          className="gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          Atualizar
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="fingerprints" className="gap-2">
            <Fingerprint className="w-4 h-4" />
            Fingerprints
          </TabsTrigger>
          <TabsTrigger value="ip-attempts" className="gap-2">
            <Globe className="w-4 h-4" />
            Tentativas por IP
          </TabsTrigger>
          <TabsTrigger value="domains" className="gap-2">
            <Mail className="w-4 h-4" />
            Domínios Bloqueados
          </TabsTrigger>
        </TabsList>

        {/* Fingerprints Tab */}
        <TabsContent value="fingerprints">
          <Card>
            <CardHeader>
              <CardTitle>Device Fingerprints</CardTitle>
              <CardDescription>
                Registros de dispositivos que tentaram criar trials
              </CardDescription>
            </CardHeader>
            <CardContent>
              {fingerprintsLoading ? (
                <div className="text-center py-8 text-muted-foreground">
                  Carregando...
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email Domain</TableHead>
                      <TableHead>Device</TableHead>
                      <TableHead>Localização</TableHead>
                      <TableHead>Fraud Score</TableHead>
                      <TableHead>Risco</TableHead>
                      <TableHead>Data</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {fingerprints?.filter(f => 
                      !searchQuery || 
                      f.email_domain?.includes(searchQuery) ||
                      f.browser_hash?.includes(searchQuery)
                    ).slice(0, 20).map((fp) => (
                      <TableRow key={fp.id}>
                        <TableCell className="font-medium">
                          {fp.email_domain || '-'}
                          {fp.email_is_disposable && (
                            <Badge variant="destructive" className="ml-2 text-xs">
                              Descartável
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <p>{fp.device_type || 'desktop'}</p>
                            <p className="text-xs text-muted-foreground">
                              {fp.screen_resolution}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <p>{fp.ip_country || '-'}</p>
                            {fp.ip_is_vpn && (
                              <Badge variant="outline" className="text-xs">VPN</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                              fp.fraud_score >= 70 ? 'bg-destructive text-destructive-foreground' :
                              fp.fraud_score >= 50 ? 'bg-orange-500 text-white' :
                              fp.fraud_score >= 30 ? 'bg-amber-500 text-white' :
                              'bg-green-500 text-white'
                            }`}>
                              {fp.fraud_score}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{getRiskBadge(fp.risk_level)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {fp.created_at ? formatDistanceToNow(new Date(fp.created_at), { 
                            addSuffix: true, 
                            locale: ptBR 
                          }) : '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* IP Attempts Tab */}
        <TabsContent value="ip-attempts">
          <Card>
            <CardHeader>
              <CardTitle>Tentativas por IP</CardTitle>
              <CardDescription>
                Histórico de tentativas de criação de trial por endereço IP
              </CardDescription>
            </CardHeader>
            <CardContent>
              {ipLoading ? (
                <div className="text-center py-8 text-muted-foreground">
                  Carregando...
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>IP Address</TableHead>
                      <TableHead>Email Domain</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Motivo do Bloqueio</TableHead>
                      <TableHead>Data</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ipAttempts?.filter(a => 
                      !searchQuery || 
                      String(a.ip_address || '').includes(searchQuery) ||
                      String(a.email_domain || '').includes(searchQuery)
                    ).slice(0, 20).map((attempt) => (
                      <TableRow key={attempt.id}>
                        <TableCell className="font-mono">
                          {String(attempt.ip_address || '')}
                        </TableCell>
                        <TableCell>{attempt.email_domain || '-'}</TableCell>
                        <TableCell>
                          {attempt.was_blocked ? (
                            <Badge variant="destructive" className="gap-1">
                              <XCircle className="w-3 h-3" />
                              Bloqueado
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="gap-1">
                              <CheckCircle className="w-3 h-3" />
                              Permitido
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {attempt.block_reason || '-'}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {attempt.attempted_at ? format(new Date(attempt.attempted_at), 'dd/MM/yyyy HH:mm', { locale: ptBR }) : '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Domains Tab */}
        <TabsContent value="domains">
          <Card>
            <CardHeader>
              <CardTitle>Domínios de Email Bloqueados</CardTitle>
              <CardDescription>
                Lista de domínios de email descartáveis que são automaticamente bloqueados
              </CardDescription>
            </CardHeader>
            <CardContent>
              {domainsLoading ? (
                <div className="text-center py-8 text-muted-foreground">
                  Carregando...
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
                  {disposableDomains?.map((domain) => (
                    <Badge key={domain.domain} variant="outline" className="justify-center py-2">
                      {domain.domain}
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
