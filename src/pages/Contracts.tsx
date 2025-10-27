import { useEffect, useState } from 'react';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { Contract, listContracts, getContractStats, deleteContract } from '@/services/crm/contracts';
import { ContractKPIs } from '@/components/contracts/ContractKPIs';
import { ContractCharts } from '@/components/contracts/ContractCharts';
import { ContractFilters } from '@/components/contracts/ContractFilters';
import { ContractTable } from '@/components/contracts/ContractTable';
import { ContractDetailModal } from '@/components/contracts/ContractDetailModal';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { useToast } from '@/hooks/use-toast';

export default function Contracts() {
  const { toast } = useToast();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [filteredContracts, setFilteredContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);

  // Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [contracts, searchTerm, statusFilter, typeFilter]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [contractsData, statsData] = await Promise.all([
        listContracts(),
        getContractStats(),
      ]);
      setContracts(contractsData);
      setStats(statsData);
    } catch (error) {
      toast({
        title: 'Erro ao carregar contratos',
        description: 'Tente novamente mais tarde',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...contracts];

    // Filtro de busca
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (contract) =>
          contract.clientName.toLowerCase().includes(search) ||
          contract.clientDocument.toLowerCase().includes(search) ||
          contract.clientEmail.toLowerCase().includes(search)
      );
    }

    // Filtro de status
    if (statusFilter !== 'all') {
      filtered = filtered.filter((contract) => contract.status === statusFilter);
    }

    // Filtro de tipo
    if (typeFilter !== 'all') {
      filtered = filtered.filter((contract) => contract.type === typeFilter);
    }

    setFilteredContracts(filtered);
  };

  const handleClearFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setTypeFilter('all');
  };

  const handleView = (contract: Contract) => {
    setSelectedContract(contract);
    setDetailModalOpen(true);
  };

  const handleEdit = (contract: Contract) => {
    toast({
      title: 'Em desenvolvimento',
      description: 'Funcionalidade de edição em breve',
    });
  };

  const handleDelete = async (contractId: string) => {
    try {
      await deleteContract(contractId);
      toast({
        title: 'Contrato excluído',
        description: 'O contrato foi removido com sucesso',
      });
      loadData();
    } catch (error) {
      toast({
        title: 'Erro ao excluir contrato',
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-full">
          <LoadingSpinner />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-4 md:p-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between animate-fade-in">
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-foreground">Contratos</h1>
            <p className="text-sm md:text-base text-muted-foreground mt-1">
              Gerencie todos os seus contratos em um só lugar
            </p>
          </div>
          <Button className="w-full md:w-auto">
            <Plus className="mr-2 h-4 w-4" />
            Novo Contrato
          </Button>
        </div>

        {/* KPIs */}
        {stats && (
          <div className="animate-fade-in" style={{ animationDelay: '100ms' }}>
            <ContractKPIs stats={stats} />
          </div>
        )}

        {/* Gráficos */}
        <div className="animate-fade-in" style={{ animationDelay: '200ms' }}>
          <ContractCharts contracts={contracts} />
        </div>

        {/* Filtros */}
        <div className="animate-fade-in" style={{ animationDelay: '300ms' }}>
          <ContractFilters
            searchTerm={searchTerm}
            statusFilter={statusFilter}
            typeFilter={typeFilter}
            onSearchChange={setSearchTerm}
            onStatusFilterChange={setStatusFilter}
            onTypeFilterChange={setTypeFilter}
            onClearFilters={handleClearFilters}
          />
        </div>

        {/* Tabela */}
        <div className="animate-fade-in" style={{ animationDelay: '400ms' }}>
          <ContractTable
            contracts={filteredContracts}
            onView={handleView}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        </div>

        {/* Modal de Detalhes */}
        <ContractDetailModal
          contract={selectedContract}
          open={detailModalOpen}
          onClose={() => setDetailModalOpen(false)}
        />
      </div>
    </Layout>
  );
}
