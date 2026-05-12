import { useState } from 'react';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Pencil, Trash2, Search, Settings, ImageIcon, Upload, Download, AlertCircle, Copy } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listProducts, deleteProduct, toggleProductStatus, createProduct, type Product } from '@/services/supabase/products';
// ProductModal removido em favor de página dedicada (/app/products/:id/edit)
import { ImportProductsModal } from '@/components/products/ImportProductsModal';
import { ExportProductsModal } from '@/components/products/ExportProductsModal';
import { ProductAnalytics } from '@/components/products/ProductAnalytics';
import { useToast } from '@/hooks/use-toast';
import { useProductCategories } from '@/hooks/useProductCategories';
import { Link, useNavigate } from 'react-router-dom';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export default function Products() {
  // ALL HOOKS MUST BE AT THE TOP - before any conditional returns
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { organization, loading: orgLoading, sessionChecked, hasSession } = useCurrentUser();
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [priceMin, setPriceMin] = useState<string>('');
  const [priceMax, setPriceMax] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState<string | null>(null);

  const { categories } = useProductCategories();

  const { data: productsData, isLoading } = useQuery({
    queryKey: ['products', searchQuery],
    queryFn: () => listProducts({ q: searchQuery }),
    enabled: !!organization,
  });

  const deleteMutation = useMutation({
    mutationFn: deleteProduct,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast({ title: 'Produto excluído com sucesso' });
      setDeleteDialog(null);
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'Erro ao excluir', description: error.message });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: toggleProductStatus,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast({ title: 'Status atualizado' });
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: async (product: Product) => {
      // Build duplicate data, only including defined values to avoid validation errors
      const duplicateData: Record<string, unknown> = {
        name: `${product.name} (Cópia)`,
        active: true,
        type: product.type,
        unit: product.unit,
        ipi_percent: product.ipi_percent ?? 0,
        billing_type: product.billing_type ?? 'one_time',
        counts_for_commission: product.counts_for_commission ?? true,
      };

      // Only add optional fields if they have values
      if (product.code) duplicateData.code = `${product.code}-COPY`;
      if (product.description) duplicateData.description = product.description;
      if (product.price !== null && product.price !== undefined) duplicateData.price = product.price;
      if (product.category_id) duplicateData.category_id = product.category_id;
      if (product.reference) duplicateData.reference = product.reference;
      if (product.cost !== null && product.cost !== undefined) duplicateData.cost = product.cost;
      if (product.image_url) duplicateData.image_url = product.image_url;
      if (product.billing_cycle) duplicateData.billing_cycle = product.billing_cycle;
      if (product.monthly_price !== null && product.monthly_price !== undefined) duplicateData.monthly_price = product.monthly_price;
      if (product.minimum_contract_months !== null && product.minimum_contract_months !== undefined) duplicateData.minimum_contract_months = product.minimum_contract_months;

      return createProduct(duplicateData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast({ title: 'Produto duplicado com sucesso' });
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'Erro ao duplicar', description: error.message });
    },
  });

  // NOW conditional returns are allowed (after all hooks)
  if (!sessionChecked || orgLoading) {
    return (
      <Layout>
        <div className="p-4 md:p-8">
          <div className="text-center py-8 text-muted-foreground">Carregando...</div>
        </div>
      </Layout>
    );
  }

  if (!hasSession) {
    return (
      <Layout>
        <div className="p-4 md:p-8">
          <div className="text-center py-8 text-muted-foreground">Redirecionando...</div>
        </div>
      </Layout>
    );
  }

  if (!organization) {
    return (
      <Layout>
        <div className="p-4 md:p-8">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Erro de Acesso</AlertTitle>
            <AlertDescription>
              Você precisa pertencer a uma organização para acessar esta página.
              Entre em contato com o administrador do sistema.
            </AlertDescription>
          </Alert>
        </div>
      </Layout>
    );
  }

  const allProducts = productsData?.data || [];
  
  // Apply filters
  const products = allProducts.filter((p) => {
    if (typeFilter !== 'all' && p.type !== typeFilter) return false;
    if (categoryFilter !== 'all' && p.category_id !== categoryFilter) return false;
    if (statusFilter === 'active' && !p.active) return false;
    if (statusFilter === 'inactive' && p.active) return false;
    
    // Price range filter
    const price = p.price || 0;
    const min = priceMin ? parseFloat(priceMin) : 0;
    const max = priceMax ? parseFloat(priceMax) : Infinity;
    if (price < min || price > max) return false;
    
    return true;
  });

  return (
    <Layout>
      <div className="p-4 md:p-8 space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-foreground">Produtos & Serviços</h1>
            <p className="text-sm md:text-base text-muted-foreground mt-1">
              Gerencie seu catálogo completo
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setImportModalOpen(true)}>
              <Upload className="h-4 w-4 mr-2" />
              Importar
            </Button>
            <Button variant="outline" onClick={() => setExportModalOpen(true)}>
              <Download className="h-4 w-4 mr-2" />
              Exportar
            </Button>
            <Button variant="outline" asChild>
              <Link to="/app/settings/product-settings">
                <Settings className="h-4 w-4 mr-2" />
                Configurações
              </Link>
            </Button>
            <Button onClick={() => navigate('/app/products/new')}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Produto
            </Button>
          </div>
        </div>

        {/* Dashboard Analytics */}
        <ProductAnalytics />

        <Card>
          <CardHeader>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-4 md:flex-row md:items-center">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar produtos..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <div className="flex gap-2">
                  <Select value={typeFilter} onValueChange={setTypeFilter}>
                    <SelectTrigger className="w-[150px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os tipos</SelectItem>
                      <SelectItem value="produto">Produtos</SelectItem>
                      <SelectItem value="servico">Serviços</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas categorias</SelectItem>
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color }} />
                            {cat.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[140px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos status</SelectItem>
                      <SelectItem value="active">Ativos</SelectItem>
                      <SelectItem value="inactive">Inativos</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Filtro de Faixa de Preço */}
              <div className="flex gap-4 items-center">
                <div className="flex-1">
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="Preço mínimo"
                    value={priceMin}
                    onChange={(e) => setPriceMin(e.target.value)}
                  />
                </div>
                <span className="text-muted-foreground">até</span>
                <div className="flex-1">
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="Preço máximo"
                    value={priceMax}
                    onChange={(e) => setPriceMax(e.target.value)}
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setPriceMin('');
                    setPriceMax('');
                    setTypeFilter('all');
                    setCategoryFilter('all');
                    setStatusFilter('all');
                    setSearchQuery('');
                  }}
                >
                  Limpar Filtros
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Carregando...</div>
            ) : products.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhum produto encontrado
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[60px]">Imagem</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Unidade</TableHead>
                    <TableHead className="text-right">Custo</TableHead>
                    <TableHead className="text-right">Preço</TableHead>
                    <TableHead className="text-right">Margem</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.map((product) => {
                    const margin = product.cost && product.price && product.cost > 0
                      ? ((product.price - product.cost) / product.cost * 100).toFixed(1)
                      : '0.0';
                    const category = categories.find(c => c.id === product.category_id);

                    return (
                      <TableRow key={product.id}>
                        <TableCell>
                          {product.image_url ? (
                            <img
                              src={product.image_url}
                              alt={product.name}
                              className="w-10 h-10 rounded object-cover"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded bg-muted flex items-center justify-center">
                              <ImageIcon className="w-5 h-5 text-muted-foreground" />
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="font-medium">{product.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {product.type === 'produto' ? 'Produto' : 'Serviço'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {category ? (
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: category.color }} />
                              <span className="text-sm">{category.name}</span>
                            </div>
                          ) : (
                            <span className="text-sm text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">{product.unit}</TableCell>
                        <TableCell className="text-right">
                          {product.cost ? `R$ ${product.cost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          {product.price ? `R$ ${product.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          <span className={parseFloat(margin) > 0 ? 'text-success font-semibold' : 'text-muted-foreground'}>
                            {margin}%
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={product.active ? 'default' : 'secondary'}
                            className="cursor-pointer"
                            onClick={() => toggleMutation.mutate(product.id)}
                          >
                            {product.active ? 'Ativo' : 'Inativo'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => duplicateMutation.mutate(product)}
                              title="Duplicar"
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => navigate(`/app/products/${product.id}/edit`)}
                              title="Editar"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setDeleteDialog(product.id)}
                              title="Excluir"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <ProductModal
        open={modalOpen}
        onOpenChange={(open) => {
          setModalOpen(open);
          if (!open) setEditingProduct(undefined);
        }}
        product={editingProduct}
      />

      <ImportProductsModal
        open={importModalOpen}
        onOpenChange={setImportModalOpen}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ['products'] })}
      />

      <ExportProductsModal
        open={exportModalOpen}
        onOpenChange={setExportModalOpen}
      />

      <AlertDialog open={!!deleteDialog} onOpenChange={() => setDeleteDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este produto? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteDialog && deleteMutation.mutate(deleteDialog)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}
