import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { OTELevelsConfig } from './config/OTELevelsConfig';
import { OTEMultipliersConfig } from './config/OTEMultipliersConfig';
import { OTESellerAssignment } from './config/OTESellerAssignment';
import { OTERulesConfig } from './config/OTERulesConfig';
import { Layers, Percent, Users, Zap } from 'lucide-react';

export function OTEConfigurationTab() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Configurações OTE</CardTitle>
        <CardDescription>
          Configure níveis, multiplicadores, regras de aceleradores e atribua vendedores
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="levels" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="levels" className="flex items-center gap-2">
              <Layers className="h-4 w-4" />
              Níveis
            </TabsTrigger>
            <TabsTrigger value="multipliers" className="flex items-center gap-2">
              <Percent className="h-4 w-4" />
              Multiplicadores
            </TabsTrigger>
            <TabsTrigger value="rules" className="flex items-center gap-2">
              <Zap className="h-4 w-4" />
              Regras
            </TabsTrigger>
            <TabsTrigger value="sellers" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Vendedores
            </TabsTrigger>
          </TabsList>

          <TabsContent value="levels">
            <OTELevelsConfig />
          </TabsContent>

          <TabsContent value="multipliers">
            <OTEMultipliersConfig />
          </TabsContent>

          <TabsContent value="rules">
            <OTERulesConfig />
          </TabsContent>

          <TabsContent value="sellers">
            <OTESellerAssignment />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
