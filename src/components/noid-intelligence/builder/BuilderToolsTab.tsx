import { useState, useEffect } from 'react';
import { Save, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useToolsRegistry } from '@/hooks/useAgentBuilder';
import type { AgentBuilderConfig, AIAgentTool, ToolExecutionMode } from '@/types/ai-agents';
import { TOOL_EXECUTION_MODE_LABELS, RISK_LEVEL_LABELS, RISK_LEVEL_COLORS } from '@/types/ai-agents';

interface Props {
  config: AgentBuilderConfig;
  onSave: (payload: Record<string, unknown>) => Promise<void>;
  saving: boolean;
  disabled: boolean;
}

export default function BuilderToolsTab({ config, onSave, saving, disabled }: Props) {
  const { data: registry } = useToolsRegistry();
  const [tools, setTools] = useState<AIAgentTool[]>(config.tools || []);
  const [search, setSearch] = useState('');

  useEffect(() => { setTools(config.tools || []); }, [config.tools]);

  const getToolConfig = (toolId: string) => tools.find(t => t.tool_id === toolId);

  const toggleTool = (toolId: string, enabled: boolean) => {
    const existing = tools.find(t => t.tool_id === toolId);
    if (existing) {
      setTools(tools.map(t => t.tool_id === toolId ? { ...t, is_enabled: enabled } : t));
    } else {
      setTools([...tools, { tool_id: toolId, is_enabled: enabled, execution_mode: 'allowed', config_json: {}, guardrails_json: {} }]);
    }
  };

  const updateToolMode = (toolId: string, mode: ToolExecutionMode) => {
    setTools(tools.map(t => t.tool_id === toolId ? { ...t, execution_mode: mode } : t));
  };

  const handleSave = () => {
    onSave({ tools: tools.filter(t => t.is_enabled) });
  };

  const filtered = (registry || []).filter(r =>
    !search || r.name.toLowerCase().includes(search.toLowerCase()) || r.category.toLowerCase().includes(search.toLowerCase())
  );

  const categories = [...new Set(filtered.map(r => r.category))];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Tools</h2>
          <p className="text-sm text-muted-foreground">Defina o arsenal do agente</p>
        </div>
        {!disabled && (
          <Button onClick={handleSave} disabled={saving}><Save className="h-4 w-4 mr-1" /> Salvar</Button>
        )}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Buscar ferramentas..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {categories.map(cat => (
        <div key={cat} className="space-y-3">
          <h3 className="text-sm font-medium capitalize text-muted-foreground">{cat}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filtered.filter(r => r.category === cat).map(tool => {
              const tc = getToolConfig(tool.id);
              const enabled = tc?.is_enabled ?? false;
              return (
                <Card key={tool.id} className={enabled ? 'border-primary/30' : ''}>
                  <CardContent className="pt-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <p className="font-medium text-sm">{tool.name}</p>
                        <p className="text-xs text-muted-foreground">{tool.description}</p>
                      </div>
                      <Switch checked={enabled} onCheckedChange={v => toggleTool(tool.id, v)} disabled={disabled} />
                    </div>
                    <div className="flex flex-wrap gap-1">
                      <Badge className={`text-xs ${RISK_LEVEL_COLORS[tool.risk_level] || ''}`}>
                        {RISK_LEVEL_LABELS[tool.risk_level] || tool.risk_level}
                      </Badge>
                      {tool.requires_approval_by_default && (
                        <Badge variant="outline" className="text-xs">Requer aprovação</Badge>
                      )}
                      {tool.supports_autonomous && (
                        <Badge variant="outline" className="text-xs">Autônomo</Badge>
                      )}
                    </div>
                    {enabled && (
                      <div className="space-y-1 pt-1 border-t">
                        <Label className="text-xs">Modo de execução</Label>
                        <Select value={tc?.execution_mode || 'allowed'} onValueChange={v => updateToolMode(tool.id, v as ToolExecutionMode)} disabled={disabled}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {Object.entries(TOOL_EXECUTION_MODE_LABELS).map(([k, v]) => (
                              <SelectItem key={k} value={k}>{v}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
