import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Target, Search, X, ExternalLink, Brain } from 'lucide-react';
import { cn } from '@/lib/utils';
import { OpportunityScoreBadge } from '../OpportunityScoreBadge';
import { OpportunityScoreFilters, OpportunityWithScore } from '@/hooks/useOpportunityScoreAnalytics';

interface OpportunityScoreTableProps {
  opportunities: OpportunityWithScore[];
  filters: OpportunityScoreFilters;
  setFilters: (filters: OpportunityScoreFilters | ((prev: OpportunityScoreFilters) => OpportunityScoreFilters)) => void;
  isLoading: boolean;
}

const formatCurrency = (value: number) => 
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

export function OpportunityScoreTable({ opportunities, filters, setFilters, isLoading }: OpportunityScoreTableProps) {
  const navigate = useNavigate();
  const [searchValue, setSearchValue] = useState(filters.search || '');

  const handleSearch = (value: string) => {
    setSearchValue(value);
    setFilters(prev => ({ ...prev, search: value }));
  };

  const clearFilters = () => {
    setSearchValue('');
    setFilters({});
  };

  const hasActiveFilters = filters.scoreRange || filters.hasHighRisk || filters.search;

  if (isLoading) {
    return <Card><CardHeader><Skeleton className="h-6 w-48" /></CardHeader><CardContent><Skeleton className="h-64 w-full" /></CardContent></Card>;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            Oportunidades por Score
            <Badge variant="secondary">{opportunities.length} opps</Badge>
          </CardTitle>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <X className="h-4 w-4 mr-1" />
              Limpar Filtros
            </Button>
          )}
        </div>
        
        {/* Filters */}
        <div className="flex flex-wrap gap-3 mt-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar por deal ou empresa..." value={searchValue} onChange={(e) => handleSearch(e.target.value)} className="pl-9" />
          </div>
          
          <Select value={filters.scoreRange || 'all'} onValueChange={(v) => setFilters(prev => ({ ...prev, scoreRange: v === 'all' ? null : v as any }))}>
            <SelectTrigger className="w-[140px]"><SelectValue placeholder="Score" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos Scores</SelectItem>
              <SelectItem value="high">Alto (≥70)</SelectItem>
              <SelectItem value="medium">Médio (40-69)</SelectItem>
              <SelectItem value="low">Baixo (&lt;40)</SelectItem>
            </SelectContent>
          </Select>
          
          <Select value={filters.hasHighRisk === true ? 'yes' : 'all'} onValueChange={(v) => setFilters(prev => ({ ...prev, hasHighRisk: v === 'yes' ? true : null }))}>
            <SelectTrigger className="w-[140px]"><SelectValue placeholder="Risco" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos Riscos</SelectItem>
              <SelectItem value="yes">Alto Risco</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Deal</TableHead>
                <TableHead>Empresa</TableHead>
                <TableHead className="text-center">Opp Score</TableHead>
                <TableHead className="text-center">Engagement</TableHead>
                <TableHead className="text-center">Velocity</TableHead>
                <TableHead className="text-center">Risk</TableHead>
                <TableHead className="text-center">AI Win %</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead className="text-right">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {opportunities.slice(0, 50).map((opp) => (
                <TableRow key={opp.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/app/opportunities/${opp.id}`)}>
                  <TableCell><div className="font-medium">{opp.title}</div></TableCell>
                  <TableCell><div className="text-sm text-muted-foreground">{opp.account?.nome_fantasia || opp.account?.razao_social}</div></TableCell>
                  <TableCell className="text-center">
                    <OpportunityScoreBadge score={opp.opportunity_score || 0} riskScore={opp.risk_score} winProbability={opp.win_probability_ai} />
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline" className={cn("font-mono", (opp.engagement_score || 0) >= 70 ? "text-green-600" : (opp.engagement_score || 0) >= 40 ? "text-yellow-600" : "text-red-600")}>
                      {opp.engagement_score || 0}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline" className={cn("font-mono", (opp.velocity_score || 0) >= 70 ? "text-green-600" : (opp.velocity_score || 0) >= 40 ? "text-yellow-600" : "text-red-600")}>
                      {opp.velocity_score || 0}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline" className={cn("font-mono", (opp.risk_score || 0) >= 60 ? "text-red-600" : (opp.risk_score || 0) >= 40 ? "text-yellow-600" : "text-green-600")}>
                      {opp.risk_score || 0}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    {opp.win_probability_ai ? (
                      <div className="flex items-center justify-center gap-1">
                        <Brain className="h-3 w-3 text-purple-500" />
                        <span className="font-medium text-purple-600">{opp.win_probability_ai}%</span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-xs">N/A</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-medium">{formatCurrency(opp.valor_previsto || 0)}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); navigate(`/app/opportunities/${opp.id}`); }}>
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {opportunities.length === 0 && (
                <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Nenhuma oportunidade encontrada</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        {opportunities.length > 50 && (
          <div className="text-center text-sm text-muted-foreground mt-4">Mostrando 50 de {opportunities.length} oportunidades</div>
        )}
      </CardContent>
    </Card>
  );
}
