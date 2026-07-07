import { Layout } from '@/components/Layout';
import { PageContainer } from '@/components/ui/page-container';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AccessDenied } from '@/components/AccessDenied';
import { usePermissions } from '@/hooks/usePermissions';
import {
  Boxes,
  Cable,
  Radar,
  Layers,
  MapPin,
  AlertTriangle,
  Workflow,
  Plug,
  Server,
  ShieldCheck,
} from 'lucide-react';

const consumedData = [
  {
    icon: Layers,
    title: 'Categorias',
    status: 'Futuro sync',
    description:
      'Pilares macro do inventário, como Conectividade, Credenciamento, Acesso, Sensoriamento, Totens e Infraestrutura.',
  },
  {
    icon: Cable,
    title: 'Famílias',
    status: 'Futuro sync',
    description:
      'Subgrupos operacionais, como Roteadores 5G, Chips de Dados, Cabos de Rede, BLE Beacons e Totens.',
  },
  {
    icon: MapPin,
    title: 'Disponibilidade',
    status: 'Futura API',
    description:
      'Consulta se os recursos exigidos por uma proposta estão disponíveis no período operacional.',
  },
  {
    icon: Radar,
    title: 'Ocupação',
    status: 'Futura API',
    description: 'Percentual de comprometimento do estoque no período consultado.',
  },
  {
    icon: AlertTriangle,
    title: 'Alertas comerciais',
    status: 'Futura API',
    description:
      'Sinais como estoque crítico, indisponível, parcialmente disponível ou sujeito à aprovação operacional.',
  },
];

const responsibilities = [
  {
    system: 'Eventrix',
    role: 'Fonte oficial do inventário físico, reservas, movimentações e disponibilidade.',
  },
  {
    system: 'NOID CRM',
    role: 'Produtos comerciais, propostas, composição de inventário e aplicação comercial da disponibilidade.',
  },
  {
    system: 'ERP',
    role: 'Patrimônio, custos, compras, baixas e impactos financeiros.',
  },
];

const bomExample = [
  { product: 'LEGAL Core Indoor', category: 'Conectividade', family: 'Roteadores 5G', qty: 1 },
  { product: 'LEGAL X Go Pro', category: 'Conectividade', family: 'Roteadores 5G', qty: 1 },
  { product: 'LEGAL X Go Pro', category: 'Conectividade', family: 'Chips de Dados', qty: 2 },
];

const demandFactors = [
  { range: 'Menor que 50%', factor: '0%' },
  { range: '50% a 75%', factor: '+10% no valor da solução' },
  { range: '76% a 90%', factor: '+20% no valor da solução' },
  { range: 'Acima de 90%', factor: '+30% no valor da solução' },
];

const futureFlow = [
  'Vendedor monta a proposta no NOID',
  'NOID identifica a composição de inventário dos produtos',
  'NOID consulta o Eventrix',
  'Eventrix retorna disponibilidade, ocupação e alertas',
  'NOID aplica fator de demanda na tabela dinâmica',
  'Proposta salva snapshot da consulta',
];

const endpoints = [
  'GET categorias do inventário',
  'GET famílias do inventário',
  'POST consulta de disponibilidade',
  'POST criação de pré-reserva',
  'POST confirmação de reserva',
  'POST cancelamento/liberação de reserva',
];

export default function EventrixInventorySettings() {
  const { isOwner, isAdmin, orgRole, loading } = usePermissions();

  if (loading) return null;

  const canAccess =
    isOwner ||
    isAdmin ||
    orgRole === 'operations' ||
    orgRole === 'operacional' ||
    orgRole === 'commercial_manager' ||
    orgRole === 'sales_manager';

  if (!canAccess) {
    return (
      <Layout pageTitle="Inventário Eventrix">
        <AccessDenied
          title="Acesso restrito"
          description="Esta configuração é reservada aos perfis Owner, Admin, Operacional e Gestores Comerciais."
        />
      </Layout>
    );
  }

  return (
    <Layout pageTitle="Inventário Eventrix">
      <PageContainer>
        <PageHeader
          icon={Boxes}
          title="Inventário conectado ao Eventrix"
          subtitle="O Eventrix será a fonte oficial do inventário físico. O NOID consumirá essas informações para propostas, disponibilidade e tabela dinâmica."
          badge={{ label: 'Eventrix master', icon: ShieldCheck }}
          variant="teal"
        />

        <div className="space-y-6">
          {/* Bloco 1 — Status da integração */}
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Plug className="h-5 w-5" />
                    Status da integração
                  </CardTitle>
                  <CardDescription className="mt-1">
                    A integração será usada para consultar categorias, famílias, disponibilidade,
                    ocupação de estoque e alertas comerciais.
                  </CardDescription>
                </div>
                <Badge variant="outline">Em preparação</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border border-dashed p-4 text-sm">
                <div className="flex items-center gap-2 font-medium">
                  <span className="inline-block h-2 w-2 rounded-full bg-amber-500" />
                  Aguardando conexão com Eventrix
                </div>
                <p className="text-muted-foreground mt-2">
                  Nenhuma chamada externa é feita neste momento. A conexão real será habilitada em
                  uma próxima etapa.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Bloco 2 — Responsabilidades */}
          <Card>
            <CardHeader>
              <CardTitle>Responsabilidades dos sistemas</CardTitle>
              <CardDescription>
                O NOID não gerencia mais estoque físico. Ele apenas consome informações operacionais
                do Eventrix para apoiar a venda.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-hidden rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left px-4 py-2 font-medium">Sistema</th>
                      <th className="text-left px-4 py-2 font-medium">Responsabilidade</th>
                    </tr>
                  </thead>
                  <tbody>
                    {responsibilities.map((r) => (
                      <tr key={r.system} className="border-t">
                        <td className="px-4 py-3 font-medium">{r.system}</td>
                        <td className="px-4 py-3 text-muted-foreground">{r.role}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Bloco 3 — Dados consumidos */}
          <Card>
            <CardHeader>
              <CardTitle>Dados consumidos do Eventrix</CardTitle>
              <CardDescription>
                Categorias, famílias e sinais operacionais serão sincronizados a partir do Eventrix
                quando a integração for ligada.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {consumedData.map((item) => (
                  <div
                    key={item.title}
                    className="rounded-lg border p-4 flex flex-col gap-2 bg-card"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 font-medium">
                        <item.icon className="h-4 w-4 text-primary" />
                        {item.title}
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        {item.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{item.description}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Bloco 4 — Composição de Inventário dos Produtos */}
          <Card>
            <CardHeader>
              <CardTitle>Composição de Inventário dos Produtos</CardTitle>
              <CardDescription>
                Os produtos comerciais do NOID poderão apontar quais categorias e famílias do
                Eventrix são necessárias para entregar cada solução.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="overflow-hidden rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left px-4 py-2 font-medium">Produto comercial</th>
                      <th className="text-left px-4 py-2 font-medium">Categoria Eventrix</th>
                      <th className="text-left px-4 py-2 font-medium">Família Eventrix</th>
                      <th className="text-left px-4 py-2 font-medium">Qtd por unidade</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bomExample.map((row, i) => (
                      <tr key={i} className="border-t">
                        <td className="px-4 py-2 font-medium">{row.product}</td>
                        <td className="px-4 py-2 text-muted-foreground">{row.category}</td>
                        <td className="px-4 py-2 text-muted-foreground">{row.family}</td>
                        <td className="px-4 py-2">{row.qty}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-sm text-muted-foreground">
                O produto comercial vive no NOID. O ativo físico vive no Eventrix. A composição
                conecta os dois mundos.
              </p>
            </CardContent>
          </Card>

          {/* Bloco 5 — Fator de demanda por ocupação */}
          <Card>
            <CardHeader>
              <CardTitle>Fator de demanda por ocupação</CardTitle>
              <CardDescription>
                Quando a integração estiver ativa, o NOID usará a ocupação retornada pelo Eventrix
                para ajustar a tabela dinâmica.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="overflow-hidden rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left px-4 py-2 font-medium">Ocupação retornada pelo Eventrix</th>
                      <th className="text-left px-4 py-2 font-medium">Fator aplicado no NOID</th>
                    </tr>
                  </thead>
                  <tbody>
                    {demandFactors.map((row) => (
                      <tr key={row.range} className="border-t">
                        <td className="px-4 py-2">{row.range}</td>
                        <td className="px-4 py-2 font-medium">{row.factor}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-muted-foreground">
                O Eventrix calcula a ocupação. O NOID aplica o fator comercial.
              </p>
            </CardContent>
          </Card>

          {/* Bloco 6 — Fluxo futuro */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Workflow className="h-5 w-5" />
                Fluxo futuro na proposta
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="space-y-2">
                {futureFlow.map((step, i) => (
                  <li key={i} className="flex gap-3 text-sm">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-semibold">
                      {i + 1}
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>

          {/* Bloco 7 — Endpoints planejados */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Server className="h-5 w-5" />
                Endpoints planejados
              </CardTitle>
              <CardDescription>
                Interface prevista para a próxima sprint de integração. Nenhuma chamada real é
                feita agora.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {endpoints.map((e) => (
                  <div
                    key={e}
                    className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                  >
                    <code className="font-mono text-xs md:text-sm">{e}</code>
                    <Badge variant="outline" className="text-xs">
                      Planejado
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </PageContainer>
    </Layout>
  );
}
