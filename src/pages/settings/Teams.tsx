import { Layout } from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useTeams } from '@/hooks/useTeams';
import { usePermissions } from '@/hooks/usePermissions';
import { Plus, Users, Target, Edit } from 'lucide-react';

export default function TeamsSettings() {
  const { teams, loading } = useTeams();
  const { isAdmin, isOwner } = usePermissions();

  const canManage = isAdmin || isOwner;

  return (
    <Layout>
      <div className="p-4 md:p-8 space-y-6">
        <div className="flex items-center justify-between animate-fade-in">
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-foreground">Equipes</h1>
            <p className="text-sm md:text-base text-muted-foreground mt-1">
              Organize sua estrutura de vendas em equipes
            </p>
          </div>
          {canManage && (
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Nova Equipe
            </Button>
          )}
        </div>

        {loading ? (
          <Card>
            <CardContent className="py-8">
              <p className="text-center text-muted-foreground">Carregando equipes...</p>
            </CardContent>
          </Card>
        ) : teams.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Nenhuma equipe criada</h3>
              <p className="text-muted-foreground mb-4">
                Crie equipes para organizar seus vendedores e definir metas
              </p>
              {canManage && (
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Criar Primeira Equipe
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {teams.map((team, index) => (
              <Card
                key={team.id}
                className="hover:shadow-card-hover transition-all duration-300 animate-fade-in"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: team.color }}
                        />
                        <CardTitle className="text-lg">{team.name}</CardTitle>
                      </div>
                      {team.description && (
                        <CardDescription>{team.description}</CardDescription>
                      )}
                    </div>
                    {canManage && (
                      <Button variant="ghost" size="icon">
                        <Edit className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {team.manager && (
                    <div className="flex items-center gap-2 text-sm">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Gerente:</span>
                      <span className="font-medium">
                        {team.manager.full_name || 'Sem nome'}
                      </span>
                    </div>
                  )}
                  {team.monthly_goal > 0 && (
                    <div className="flex items-center gap-2 text-sm">
                      <Target className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Meta:</span>
                      <span className="font-medium">
                        {new Intl.NumberFormat('pt-BR', {
                          style: 'currency',
                          currency: 'BRL',
                        }).format(team.monthly_goal)}
                      </span>
                    </div>
                  )}
                  <div className="pt-2">
                    <Badge variant="secondary">
                      {team.members?.length || 0} membro{(team.members?.length || 0) !== 1 ? 's' : ''}
                    </Badge>
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
