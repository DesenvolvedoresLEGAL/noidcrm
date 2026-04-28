import { useState } from 'react';
import { Layout } from '@/components/Layout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users as UsersIcon, Users2, ShieldCheck, LayoutDashboard } from 'lucide-react';

import UsersContent from '@/components/settings/UsersContent';
import TeamsContent from '@/components/settings/TeamsContent';
import UserContextTab from '@/components/settings/userContext/UserContextTab';
import { AdminCenterPage } from '@/components/settings/adminCenter/AdminCenterPage';
import { useCurrentUser } from '@/hooks/useCurrentUser';

export default function TeamsAndUsers() {
  const [activeTab, setActiveTab] = useState('users');
  const { isOrgAdmin } = useCurrentUser();

  return (
    <Layout>
      <div className="p-4 md:p-8 space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Equipes e Usuários</h1>
          <p className="text-muted-foreground">Gerencie membros e estrutura de times da organização</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="users" className="gap-2">
              <UsersIcon className="h-4 w-4" />
              Usuários
            </TabsTrigger>
            <TabsTrigger value="teams" className="gap-2">
              <Users2 className="h-4 w-4" />
              Equipes
            </TabsTrigger>
            {isOrgAdmin && (
              <TabsTrigger value="context" className="gap-2">
                <ShieldCheck className="h-4 w-4" />
                Contexto CRM
              </TabsTrigger>
            )}
            {isOrgAdmin && (
              <TabsTrigger value="admin-center" className="gap-2">
                <LayoutDashboard className="h-4 w-4" />
                Admin Center
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="users" className="mt-6">
            <UsersContent />
          </TabsContent>

          <TabsContent value="teams" className="mt-6">
            <TeamsContent />
          </TabsContent>

          {isOrgAdmin && (
            <TabsContent value="context" className="mt-6">
              <UserContextTab />
            </TabsContent>
          )}

          {isOrgAdmin && (
            <TabsContent value="admin-center" className="mt-6">
              <AdminCenterPage />
            </TabsContent>
          )}
        </Tabs>
      </div>
    </Layout>
  );
}
