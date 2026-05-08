import { Boxes, Package, Wifi, CalendarCheck, Construction, Settings2 } from 'lucide-react';
import { PageContainer } from '@/components/ui/page-container';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/EmptyState';
import { AccessDenied } from '@/components/AccessDenied';
import { usePermissions } from '@/hooks/usePermissions';

const conceptCards = [
  {
    icon: Package,
    title: 'Equipamentos',
    description:
      'Controle de roteadores, access points, switches, nobreaks, tablets, totens e demais ativos físicos.',
  },
  {
    icon: Wifi,
    title: 'Chips e Conectividade',
    description:
      'Gestão de chips, operadoras, linhas, vínculos com roteadores e disponibilidade operacional.',
  },
  {
    icon: Boxes,
    title: 'Kits Operacionais',
    description:
      'Agrupamento de itens reais como roteador, chips, fonte, case e acessórios — sem estoque fictício.',
  },
  {
    icon: CalendarCheck,
    title: 'Reservas e Disponibilidade',
    description:
      'Pré-reserva automática por proposta, bloqueio por período operacional e cálculo de ocupação.',
  },
];

const futureFlows = [
  'Cadastro de equipamentos e itens por quantidade',
  'Associação entre roteadores e chips',
  'Criação de kits operacionais',
  'Pré-reserva automática em propostas com data e produto',
  'Reserva por período operacional completo',
  'Consulta de disponibilidade dentro do CRM',
  'Cálculo de demanda por ocupação do estoque',
  'Aplicação do fator demanda na tabela dinâmica',
];

const demandRules = [
  { range: 'Menor que 50%', factor: '0%' },
  { range: 'De 50% a 75%', factor: '+10% no valor da solução' },
  { range: 'De 76% a 90%', factor: '+20% no valor da solução' },
  { range: 'Acima de 90%', factor: '+30% no valor da solução' },
];

export default function Inventory() {
  const { isOwner, isAdmin, orgRole, loading } = usePermissions();

  if (loading) return null;

  const canAccess = isOwner || isAdmin || orgRole === 'operations' || orgRole === 'operacional';

  if (!canAccess) {
    return (
      <AccessDenied
        title="Acesso restrito"
        description="O módulo Inventário está disponível apenas para perfis operacionais (Owner, Admin ou Operacional)."
      />
    );
  }

  return (
    <PageContainer>
      <PageHeader
        icon={Boxes}
        title="Inventário"
        subtitle="Controle operacional de equipamentos, chips, kits, reservas e disponibilidade."
        badge={{ label: 'Módulo em implantação', icon: Construction }}
        variant="teal"
      />

      {/* Cards conceituais */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {conceptCards.map(({ icon: Icon, title, description }) => (
          <Card key={title} className="border-border/60 hover:border-border transition-colors">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                  <Icon className="h-5 w-5 text-foreground/80" />
                </div>
                <Badge variant="secondary" className="text-xs">Em breve</Badge>
              </div>
              <CardTitle className="text-base mt-3">{title}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Como o Inventário vai funcionar */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Como o Inventário vai funcionar</CardTitle>
          <CardDescription>
            O módulo Inventário será a base operacional para controlar disponibilidade real dos
            ativos da empresa. Ele permitirá reservar equipamentos por período, associar chips a
            roteadores, montar kits operacionais, acompanhar movimentações, bloquear itens em
            manutenção e alimentar a tabela dinâmica de preços com a ocupação do estoque.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 list-decimal list-inside text-sm text-foreground/90">
            {futureFlows.map((flow) => (
              <li key={flow} className="leading-relaxed">{flow}</li>
            ))}
          </ol>
        </CardContent>
      </Card>

      {/* Regra oficial de demanda */}
      <Card className="border-primary/20 bg-primary/[0.02]">
        <CardHeader>
          <CardTitle className="text-lg">Regra oficial de demanda por ocupação</CardTitle>
          <CardDescription>
            A tabela dinâmica usará a ocupação do estoque como fator de preço, desconto e aprovação.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="overflow-hidden rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left font-semibold px-4 py-3">Ocupação do estoque</th>
                  <th className="text-left font-semibold px-4 py-3">Fator aplicado</th>
                </tr>
              </thead>
              <tbody>
                {demandRules.map((rule, idx) => (
                  <tr
                    key={rule.range}
                    className={idx % 2 === 0 ? 'bg-background' : 'bg-muted/20'}
                  >
                    <td className="px-4 py-3 text-foreground">{rule.range}</td>
                    <td className="px-4 py-3 text-foreground/90">{rule.factor}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground">
            O cálculo será feito por produto, categoria e período operacional. Esta regra será
            implementada em sprint futura.
          </p>
        </CardContent>
      </Card>

      {/* Estado vazio */}
      <EmptyState
        icon={Boxes}
        title="Inventário pronto para implantação"
        description="A estrutura inicial do módulo foi criada. Nas próximas sprints serão adicionados cadastro de categorias, locais, equipamentos, chips, kits, reservas e cálculo de disponibilidade."
      />
      <div className="flex justify-center">
        <Button variant="outline" disabled className="gap-2">
          <Settings2 className="h-4 w-4" />
          Configuração em breve
        </Button>
      </div>
    </PageContainer>
  );
}
