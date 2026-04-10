import { useState, useEffect } from 'react';
import { Shield } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useAgentPermissions, useUpsertAgentPermission } from '@/hooks/useAIAgents';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';

interface OrgMember {
  user_id: string;
  full_name: string | null;
  email: string | null;
}

export default function PermissionsPage() {
  const { profile } = useCurrentUser();
  const orgId = profile?.organization_id;
  const { data: permissions, isLoading: loadingPerms } = useAgentPermissions(orgId);
  const upsertMutation = useUpsertAgentPermission();

  const { data: members, isLoading: loadingMembers } = useQuery({
    queryKey: ['org-members-for-perms', orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('organization_members')
        .select('user_id, profiles!organization_members_user_id_fkey(full_name)')
        .eq('organization_id', orgId!);
      if (error) throw error;
      return (data || []).map((m: any) => ({
        user_id: m.user_id,
        full_name: m.profiles?.full_name || null,
        email: null,
      })) as OrgMember[];
    },
    enabled: !!orgId,
  });

  const getPermForUser = (userId: string) => {
    return permissions?.find((p) => p.user_id === userId);
  };

  const togglePerm = (userId: string, field: string, currentValue: boolean) => {
    if (!orgId) return;
    const existing = getPermForUser(userId);
    upsertMutation.mutate({
      organization_id: orgId,
      user_id: userId,
      can_create: existing?.can_create ?? false,
      can_edit: existing?.can_edit ?? false,
      can_publish: existing?.can_publish ?? false,
      can_execute: existing?.can_execute ?? false,
      can_run_autonomous: existing?.can_run_autonomous ?? false,
      can_approve: existing?.can_approve ?? false,
      [field]: !currentValue,
    } as any);
  };

  const permFields = [
    { key: 'can_create', label: 'Criar' },
    { key: 'can_edit', label: 'Editar' },
    { key: 'can_publish', label: 'Publicar' },
    { key: 'can_execute', label: 'Executar' },
    { key: 'can_run_autonomous', label: 'Autônomo' },
    { key: 'can_approve', label: 'Aprovar' },
  ];

  if (loadingPerms || loadingMembers) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Shield className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">Permissões de Agentes</h1>
          <p className="text-sm text-muted-foreground">Controle o que cada membro pode fazer com agentes</p>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          {!members || members.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Nenhum membro encontrado</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuário</TableHead>
                  {permFields.map((f) => (
                    <TableHead key={f.key} className="text-center">{f.label}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((m) => {
                  const perm = getPermForUser(m.user_id);
                  return (
                    <TableRow key={m.user_id}>
                      <TableCell className="font-medium">{m.full_name || m.user_id.slice(0, 8)}</TableCell>
                      {permFields.map((f) => (
                        <TableCell key={f.key} className="text-center">
                          <Switch
                            checked={(perm as any)?.[f.key] ?? false}
                            onCheckedChange={() => togglePerm(m.user_id, f.key, (perm as any)?.[f.key] ?? false)}
                          />
                        </TableCell>
                      ))}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
