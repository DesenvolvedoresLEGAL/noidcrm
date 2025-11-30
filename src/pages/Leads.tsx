import { useEffect, useState } from 'react';
import { Layout } from '@/components/Layout';
import { FilterBar } from '@/components/FilterBar';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { listLeads } from '@/services/crm/leads';
import { Lead } from '@/services/crm/types';
import { Loader2 } from 'lucide-react';
import { formatDateBR } from '@/lib/dateUtils';

const filterFields = [
  { key: 'q', label: 'Buscar', type: 'text' as const },
  {
    key: 'status',
    label: 'Status',
    type: 'select' as const,
    options: [
      { value: 'new', label: 'Novo' },
      { value: 'contacted', label: 'Contatado' },
      { value: 'qualified', label: 'Qualificado' },
      { value: 'lost', label: 'Perdido' },
    ],
  },
  {
    key: 'source',
    label: 'Origem',
    type: 'select' as const,
    options: [
      { value: 'Website', label: 'Website' },
      { value: 'LinkedIn', label: 'LinkedIn' },
      { value: 'Indicação', label: 'Indicação' },
    ],
  },
];

export default function Leads() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<Record<string, string>>({});

  useEffect(() => {
    loadLeads();
  }, [filters]);

  const loadLeads = async () => {
    setLoading(true);
    try {
      const { q, ...rest } = filters;
      const params: { status?: string; source?: string; query?: string } = {};

      if (rest.status) {
        params.status = rest.status;
      }

      if (rest.source) {
        params.source = rest.source;
      }

      if (q) {
        params.query = q;
      }

      const data = await listLeads(params);
      setLeads(data.data);
      setTotal(data.total);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      new: 'bg-accent/20 text-accent-foreground',
      contacted: 'bg-primary/20 text-primary',
      qualified: 'bg-secondary/20 text-secondary-foreground',
      lost: 'bg-muted text-muted-foreground',
    };
    return colors[status] || 'bg-muted';
  };

  return (
    <Layout>
      <div className="p-8 space-y-6">
        <div>
          <h1 className="text-3xl font-black text-foreground">Leads</h1>
          <p className="text-muted-foreground mt-1">
            Gerencie seus leads e qualificações
          </p>
        </div>

        <FilterBar
          fields={filterFields}
          onFilterChange={setFilters}
          totalResults={total}
        />

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : leads.length === 0 ? (
          <Card className="shadow-card">
            <CardContent className="py-12 text-center text-muted-foreground">
              Nenhum lead encontrado
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {leads.map((lead) => (
              <Card
                key={lead.id}
                className="shadow-card hover:shadow-card-hover transition-all cursor-pointer"
              >
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-3">
                        <h3 className="font-semibold">Lead #{lead.id}</h3>
                        <Badge className={getStatusColor(lead.status)}>
                          {lead.status}
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground space-y-1">
                        <p>Origem: {lead.origem} • Fonte: {lead.fonte}</p>
                        {lead.intent_score !== undefined && lead.intent_score !== null &&
                         lead.fit_score !== undefined && lead.fit_score !== null && (
                          <p>
                            Intent: {lead.intent_score}/100 • Fit: {lead.fit_score}/100
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatDateBR(lead.created_at)}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
