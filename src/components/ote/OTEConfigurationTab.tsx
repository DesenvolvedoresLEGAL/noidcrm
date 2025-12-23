import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { OTELevelsConfig } from './config/OTELevelsConfig';
import { OTEMultipliersConfig } from './config/OTEMultipliersConfig';
import { OTESellerAssignment } from './config/OTESellerAssignment';
import { OTERulesConfig } from './config/OTERulesConfig';
import { OTEGlobalConfig } from './config/OTEGlobalConfig';
import { OTEFlagsConfig } from './config/OTEFlagsConfig';
import { FitScoreConfigManager } from '@/components/team/evaluations';
import { Layers, Percent, Users, Zap, Target, Flag, Star } from 'lucide-react';

export function OTEConfigurationTab() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Painel de Controle de Vendas</CardTitle>
        <CardDescription>
          Configure metas globais, níveis OTE, multiplicadores, regras, flags e atribua vendedores
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="global" className="space-y-4">
          <TabsList className="grid w-full grid-cols-7">
            <TabsTrigger value="global" className="flex items-center gap-2">
              <Target className="h-4 w-4" />
              Metas Globais
            </TabsTrigger>
            <TabsTrigger value="levels" className="flex items-center gap-2">
              <Layers className="h-4 w-4" />
              Níveis OTE
            </TabsTrigger>
            <TabsTrigger value="multipliers" className="flex items-center gap-2">
              <Percent className="h-4 w-4" />
              Multiplicadores
            </TabsTrigger>
            <TabsTrigger value="rules" className="flex items-center gap-2">
              <Zap className="h-4 w-4" />
              Regras
            </TabsTrigger>
            <TabsTrigger value="flags" className="flex items-center gap-2">
              <Flag className="h-4 w-4" />
              Flags
            </TabsTrigger>
            <TabsTrigger value="fitscore" className="flex items-center gap-2">
              <Star className="h-4 w-4" />
              FitScore
            </TabsTrigger>
            <TabsTrigger value="sellers" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Vendedores
            </TabsTrigger>
          </TabsList>

          <TabsContent value="global">
            <OTEGlobalConfig />
          </TabsContent>

          <TabsContent value="levels">
            <OTELevelsConfig />
          </TabsContent>

          <TabsContent value="multipliers">
            <OTEMultipliersConfig />
          </TabsContent>

          <TabsContent value="rules">
            <OTERulesConfig />
          </TabsContent>

          <TabsContent value="flags">
            <OTEFlagsConfig />
          </TabsContent>

          <TabsContent value="fitscore">
            <FitScoreConfigManager />
          </TabsContent>

          <TabsContent value="sellers">
            <OTESellerAssignment />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}