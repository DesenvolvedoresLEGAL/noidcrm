import { useState } from 'react';
import { Layout } from '@/components/Layout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users as UsersIcon, Users2 } from 'lucide-react';

// Import the content from both pages
import UsersContent from '@/components/settings/UsersContent';
import TeamsContent from '@/components/settings/TeamsContent';

export default function TeamsAndUsers() {
  const [activeTab, setActiveTab] = useState('users');

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
          </TabsList>

          <TabsContent value="users" className="mt-6">
            <UsersContent />
          </TabsContent>

          <TabsContent value="teams" className="mt-6">
            <TeamsContent />
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
