import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { TrendingUp, Package, AlertTriangle, CheckCircle2, XCircle, Wrench, Box } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export function ProductAnalytics() {
  // Buscar TODOS os produtos (ativos e inativos)
  const { data: productsData } = useQuery({
    queryKey: ['products-analytics-all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select(`
          *,
          product_categories (
            name,
            color
          )
        `)
        .order('name');

      if (error) throw error;
      return data;
    },
  });

  // Buscar histórico de preços recentes
  const { data: priceHistory } = useQuery({
    queryKey: ['price-history'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_price_history')
        .select(`
          *,
          products (
            name
          )
        `)
        .order('changed_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      return data;
    },
  });

  const products = productsData || [];

  // Métricas - Linha 1: Visão Geral
  const totalItems = products.length;
  const activeCount = products.filter(p => p.active).length;
  const inactiveCount = products.filter(p => !p.active).length;
  const withoutCost = products.filter(p => !p.cost || p.cost === 0).length;

  // Métricas - Linha 2: Por Tipo
  const productItems = products.filter(p => p.type === 'produto');
  const serviceItems = products.filter(p => p.type === 'servico');

  const totalProducts = productItems.length;
  const totalServices = serviceItems.length;

  // Margem média de produtos
  const productsWithMargin = productItems.filter(p => p.cost && p.price && p.cost > 0);
  const avgMarginProducts = productsWithMargin.length > 0
    ? productsWithMargin.reduce((sum, p) => sum + ((p.price! - p.cost!) / p.cost! * 100), 0) / productsWithMargin.length
    : 0;

  // Margem média de serviços
  const servicesWithMargin = serviceItems.filter(p => p.cost && p.price && p.cost > 0);
  const avgMarginServices = servicesWithMargin.length > 0
    ? servicesWithMargin.reduce((sum, p) => sum + ((p.price! - p.cost!) / p.cost! * 100), 0) / servicesWithMargin.length
    : 0;

  // Produtos por categoria (apenas ativos)
  const activeProducts = products.filter(p => p.active);
  const categoryStats = activeProducts.reduce((acc, p) => {
    const catName = p.product_categories?.name || 'Sem categoria';
    if (!acc[catName]) {
      acc[catName] = {
        count: 0,
        totalValue: 0,
        avgMargin: 0,
        margins: [] as number[],
      };
    }
    acc[catName].count++;
    acc[catName].totalValue += p.price || 0;
    
    if (p.cost && p.price && p.cost > 0) {
      const margin = ((p.price - p.cost) / p.cost * 100);
      acc[catName].margins.push(margin);
    }
    return acc;
  }, {} as Record<string, any>);

  // Calcular margem média por categoria
  Object.keys(categoryStats).forEach(key => {
    const stat = categoryStats[key];
    stat.avgMargin = stat.margins.length > 0
      ? stat.margins.reduce((a: number, b: number) => a + b, 0) / stat.margins.length
      : 0;
  });

  // Top categorias por margem
  const topCategories = Object.entries(categoryStats)
    .sort(([, a]: any, [, b]: any) => b.avgMargin - a.avgMargin)
    .slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Linha 1: Visão Geral */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total de Itens</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalItems}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Produtos e serviços
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Ativos</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">{activeCount}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Disponíveis para venda
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Inativos</CardTitle>
            <XCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-muted-foreground">{inactiveCount}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Descontinuados
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Sem Custo</CardTitle>
            <AlertTriangle className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning">{withoutCost}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Sem custo definido
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Linha 2: Por Tipo */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total de Produtos</CardTitle>
            <Box className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalProducts}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Itens físicos
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Margem Média Produtos</CardTitle>
            <TrendingUp className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">
              {avgMarginProducts.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {productsWithMargin.length} com custo
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total de Serviços</CardTitle>
            <Wrench className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalServices}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Serviços oferecidos
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Margem Média Serviços</CardTitle>
            <TrendingUp className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">
              {avgMarginServices.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {servicesWithMargin.length} com custo
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Top categorias por margem */}
        <Card>
          <CardHeader>
            <CardTitle>Categorias - Margem Média</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Categoria</TableHead>
                  <TableHead className="text-center">Produtos</TableHead>
                  <TableHead className="text-right">Margem</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topCategories.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground">
                      Nenhum dado disponível
                    </TableCell>
                  </TableRow>
                ) : (
                  topCategories.map(([name, stat]: any) => (
                    <TableRow key={name}>
                      <TableCell className="font-medium">{name}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline">{stat.count}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={stat.avgMargin > 0 ? 'text-success font-semibold' : 'text-muted-foreground'}>
                          {stat.avgMargin.toFixed(1)}%
                        </span>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Histórico de alterações de preço */}
        <Card>
          <CardHeader>
            <CardTitle>Alterações de Preço Recentes</CardTitle>
          </CardHeader>
          <CardContent>
            {!priceHistory || priceHistory.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Nenhuma alteração registrada
              </p>
            ) : (
              <div className="space-y-3">
                {priceHistory.map((change) => (
                  <div key={change.id} className="flex items-center justify-between border-b pb-2">
                    <div className="flex-1">
                      <p className="text-sm font-medium">{change.products?.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(change.changed_at).toLocaleDateString('pt-BR', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                    <div className="text-right">
                      {change.old_price && change.new_price && (
                        <div className="text-sm">
                          <span className="text-muted-foreground line-through">
                            R$ {change.old_price.toFixed(2)}
                          </span>
                          {' → '}
                          <span className="font-semibold">
                            R$ {change.new_price.toFixed(2)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
