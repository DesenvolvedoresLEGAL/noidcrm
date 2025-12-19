import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Users, UserCheck, Briefcase, Headphones, Target, Info, Sparkles } from 'lucide-react';
import { useAutoHeadcount } from '@/hooks/useAutoHeadcount';

interface RoleCardProps {
  icon: React.ReactNode;
  label: string;
  count: number;
  members: { id: string; name: string; email: string }[];
  color: string;
}

function RoleCard({ icon, label, count, members, color }: RoleCardProps) {
  return (
    <Card className={`${color}`}>
      <CardContent className="pt-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-background/80 rounded-lg">
            {icon}
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{label}</span>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge variant="secondary" className="text-lg font-bold cursor-help">
                      {count}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    {members.length > 0 ? (
                      <div className="space-y-1">
                        {members.map(m => (
                          <div key={m.id} className="text-xs">
                            {m.name}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p>Nenhum membro com esta função</p>
                    )}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function HeadcountTab() {
  const { total, salesTeam, byRole, isLoading } = useAutoHeadcount();
  
  // Get counts by role
  const getCount = (roles: string[]) => {
    return byRole
      .filter(r => roles.includes(r.role))
      .reduce((sum, r) => sum + r.count, 0);
  };
  
  const getMembers = (roles: string[]) => {
    return byRole
      .filter(r => roles.includes(r.role))
      .flatMap(r => r.members);
  };
  
  const sdrCount = getCount(['sdr']);
  const salesCount = getCount(['sales', 'closer']);
  const farmerCount = getCount(['farmer']);
  const csCount = getCount(['cs']);
  const adminCount = getCount(['admin', 'manager']);
  
  if (isLoading) {
    return (
      <div className="py-8 text-center text-muted-foreground">
        Calculando headcount...
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <CardTitle className="text-lg flex items-center gap-2">
                Headcount Atual
                <Badge variant="secondary" className="text-xs font-normal">Automático</Badge>
              </CardTitle>
              <CardDescription>
                Calculado automaticamente dos membros ativos da organização
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-lg bg-background/50 text-center">
              <div className="text-3xl font-bold text-primary">{total}</div>
              <div className="text-sm text-muted-foreground">Total de Membros</div>
            </div>
            <div className="p-4 rounded-lg bg-background/50 text-center">
              <div className="text-3xl font-bold text-emerald-600">{salesTeam}</div>
              <div className="text-sm text-muted-foreground">Time Comercial</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Role breakdown */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <RoleCard
          icon={<Target className="h-5 w-5 text-blue-600" />}
          label="SDRs"
          count={sdrCount}
          members={getMembers(['sdr'])}
          color="border-blue-500/30 bg-gradient-to-br from-blue-500/5 to-transparent"
        />
        <RoleCard
          icon={<Briefcase className="h-5 w-5 text-emerald-600" />}
          label="Vendedores/Closers"
          count={salesCount}
          members={getMembers(['sales', 'closer'])}
          color="border-emerald-500/30 bg-gradient-to-br from-emerald-500/5 to-transparent"
        />
        <RoleCard
          icon={<UserCheck className="h-5 w-5 text-amber-600" />}
          label="Farmers"
          count={farmerCount}
          members={getMembers(['farmer'])}
          color="border-amber-500/30 bg-gradient-to-br from-amber-500/5 to-transparent"
        />
        <RoleCard
          icon={<Headphones className="h-5 w-5 text-purple-600" />}
          label="Customer Success"
          count={csCount}
          members={getMembers(['cs'])}
          color="border-purple-500/30 bg-gradient-to-br from-purple-500/5 to-transparent"
        />
      </div>

      {/* All roles breakdown */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" />
            Distribuição por Função
          </CardTitle>
        </CardHeader>
        <CardContent>
          {byRole.length > 0 ? (
            <div className="space-y-3">
              {byRole.map(role => (
                <div key={role.role} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{role.label}</Badge>
                    <span className="text-xs text-muted-foreground">({role.role})</span>
                  </div>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="font-semibold cursor-help">{role.count}</span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <div className="space-y-1">
                          {role.members.map(m => (
                            <div key={m.id} className="text-xs">
                              {m.name} ({m.email})
                            </div>
                          ))}
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-4">
              Nenhum membro encontrado na organização
            </p>
          )}
        </CardContent>
      </Card>

      {/* Info */}
      <div className="text-xs text-muted-foreground flex items-center gap-2">
        <Info className="h-4 w-4" />
        O headcount é calculado a partir dos membros da organização. Para alterar funções, 
        edite o papel (org_role) de cada membro nas configurações da organização.
      </div>
    </div>
  );
}
