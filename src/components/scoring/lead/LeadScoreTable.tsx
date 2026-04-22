import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Users, Search, X, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LeadGradeBadge } from '../LeadGradeBadge';
import { LeadScoreFilters, LeadWithScore } from '@/hooks/useLeadScoreAnalytics';

interface LeadScoreTableProps {
  leads: LeadWithScore[];
  filters: LeadScoreFilters;
  setFilters: (filters: LeadScoreFilters | ((prev: LeadScoreFilters) => LeadScoreFilters)) => void;
  filterOptions: {
    segments: (string | null)[];
    sizes: (string | null)[];
  };
  isLoading: boolean;
}

export function LeadScoreTable({ leads, filters, setFilters, filterOptions, isLoading }: LeadScoreTableProps) {
  const navigate = useNavigate();
  const [searchValue, setSearchValue] = useState(filters.search || '');
  const [pageSize, setPageSize] = useState(50);
  const [page, setPage] = useState(1);

  // Reset page whenever filters or page size change
  useEffect(() => {
    setPage(1);
  }, [filters, pageSize, leads.length]);

  const totalPages = Math.max(1, Math.ceil(leads.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginatedLeads = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return leads.slice(start, start + pageSize);
  }, [leads, safePage, pageSize]);
  const rangeStart = leads.length === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const rangeEnd = Math.min(safePage * pageSize, leads.length);

  const handleSearch = (value: string) => {
    setSearchValue(value);
    setFilters(prev => ({ ...prev, search: value }));
  };

  const clearFilters = () => {
    setSearchValue('');
    setFilters({});
  };

  const hasActiveFilters = filters.grade || filters.segment || filters.size || filters.search;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Leads por Score
            <Badge variant="secondary">{leads.length} leads</Badge>
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
            <Input
              placeholder="Buscar por empresa..."
              value={searchValue}
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          
          <Select 
            value={filters.grade || 'all'} 
            onValueChange={(v) => setFilters(prev => ({ ...prev, grade: v === 'all' ? null : v }))}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Grade" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas Grades</SelectItem>
              <SelectItem value="A">Grade A</SelectItem>
              <SelectItem value="B">Grade B</SelectItem>
              <SelectItem value="C">Grade C</SelectItem>
              <SelectItem value="D">Grade D</SelectItem>
              <SelectItem value="F">Grade F</SelectItem>
            </SelectContent>
          </Select>
          
          <Select 
            value={filters.segment || 'all'} 
            onValueChange={(v) => setFilters(prev => ({ ...prev, segment: v === 'all' ? null : v }))}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Segmento" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos Segmentos</SelectItem>
              {filterOptions.segments.map(seg => (
                <SelectItem key={seg} value={seg!}>{seg}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Select 
            value={filters.size || 'all'} 
            onValueChange={(v) => setFilters(prev => ({ ...prev, size: v === 'all' ? null : v }))}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Tamanho" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos Tamanhos</SelectItem>
              {filterOptions.sizes.map(size => (
                <SelectItem key={size} value={size!}>{size}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Grade</TableHead>
                <TableHead>Empresa</TableHead>
                <TableHead className="text-center">FIT</TableHead>
                <TableHead className="text-center">INTENT</TableHead>
                <TableHead className="text-center">Lead Score</TableHead>
                <TableHead>Segmento</TableHead>
                <TableHead>Tamanho</TableHead>
                <TableHead className="text-right">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leads.slice(0, 50).map((lead) => (
                <TableRow 
                  key={lead.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => navigate(`/app/accounts/${lead.id}`)}
                >
                  <TableCell>
                    <LeadGradeBadge grade={lead.lead_grade || 'N/A'} />
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{lead.nome_fantasia || lead.razao_social}</div>
                    {lead.cidade && (
                      <div className="text-xs text-muted-foreground">
                        {lead.cidade}{lead.uf ? `, ${lead.uf}` : ''}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline" className={cn(
                      "font-mono",
                      (lead.fit_score || 0) >= 70 ? "text-green-600" : 
                      (lead.fit_score || 0) >= 40 ? "text-yellow-600" : "text-red-600"
                    )}>
                      {lead.fit_score || 0}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline" className={cn(
                      "font-mono",
                      (lead.intent_score || 0) >= 70 ? "text-green-600" : 
                      (lead.intent_score || 0) >= 40 ? "text-yellow-600" : "text-red-600"
                    )}>
                      {lead.intent_score || 0}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge className={cn(
                      "font-mono font-bold",
                      (lead.lead_score || 0) >= 80 ? "bg-green-500" : 
                      (lead.lead_score || 0) >= 60 ? "bg-blue-500" :
                      (lead.lead_score || 0) >= 40 ? "bg-yellow-500" :
                      (lead.lead_score || 0) >= 20 ? "bg-orange-500" : "bg-red-500"
                    )}>
                      {lead.lead_score || 0}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {lead.segmento ? (
                      <Badge variant="secondary">{lead.segmento}</Badge>
                    ) : (
                      <span className="text-muted-foreground text-xs">Não definido</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {lead.tamanho || <span className="text-muted-foreground text-xs">N/A</span>}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/app/accounts/${lead.id}`);
                      }}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {leads.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    Nenhum lead encontrado com os filtros aplicados
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        {leads.length > 50 && (
          <div className="text-center text-sm text-muted-foreground mt-4">
            Mostrando 50 de {leads.length} leads. Use os filtros para refinar a busca.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
