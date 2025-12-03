import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { WorkflowRule } from '@/services/crm/workflow-rules';

interface AutomationCategoryBreakdownProps {
  rules: WorkflowRule[];
  onCategoryClick?: (category: string | null) => void;
  selectedCategory?: string | null;
}

interface CategoryStats {
  name: string;
  code: string;
  rules: number;
  activeRules: number;
  executions: number;
  successRate: number;
  color: string;
}

export function AutomationCategoryBreakdown({ 
  rules, 
  onCategoryClick,
  selectedCategory 
}: AutomationCategoryBreakdownProps) {
  // Categorize rules by prefix
  const categorizeRules = (): CategoryStats[] => {
    const categories: Record<string, { rules: WorkflowRule[], color: string, name: string }> = {
      'PV': { rules: [], color: 'bg-purple-500', name: 'PRÉ VENDAS' },
      'ALU': { rules: [], color: 'bg-blue-500', name: 'ALUGUE VENDAS' },
      'ACT': { rules: [], color: 'bg-green-500', name: 'Atividades' },
      'PROP': { rules: [], color: 'bg-orange-500', name: 'Propostas' },
      'ALERT': { rules: [], color: 'bg-red-500', name: 'Alertas' },
      'OTHER': { rules: [], color: 'bg-muted-foreground', name: 'Outras' },
    };

    rules.forEach(rule => {
      const name = rule.name || '';
      if (name.startsWith('PV-')) categories['PV'].rules.push(rule);
      else if (name.startsWith('ALU-')) categories['ALU'].rules.push(rule);
      else if (name.startsWith('ACT-')) categories['ACT'].rules.push(rule);
      else if (name.startsWith('PROP-')) categories['PROP'].rules.push(rule);
      else if (name.startsWith('ALERT-')) categories['ALERT'].rules.push(rule);
      else categories['OTHER'].rules.push(rule);
    });

    return Object.entries(categories)
      .filter(([_, cat]) => cat.rules.length > 0)
      .map(([code, cat]) => {
        const totalExecutions = cat.rules.reduce((acc, r) => acc + (r.executions_count || 0), 0);
        const activeRules = cat.rules.filter(r => r.is_active).length;
        
        return {
          code,
          name: cat.name,
          rules: cat.rules.length,
          activeRules,
          executions: totalExecutions,
          successRate: 100, // Would need execution data per rule
          color: cat.color,
        };
      })
      .sort((a, b) => b.rules - a.rules);
  };

  const categories = categorizeRules();
  const totalRules = rules.length;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {categories.map((cat) => (
        <Card 
          key={cat.code} 
          className={`cursor-pointer transition-all hover:shadow-md ${
            selectedCategory === cat.code 
              ? 'ring-2 ring-primary' 
              : ''
          }`}
          onClick={() => onCategoryClick?.(selectedCategory === cat.code ? null : cat.code)}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className={`h-3 w-3 rounded-full ${cat.color}`} />
              <Badge variant="outline" className="text-xs">
                {cat.activeRules}/{cat.rules}
              </Badge>
            </div>
            
            <h4 className="font-medium text-sm truncate mb-1">{cat.name}</h4>
            
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{cat.executions} exec.</span>
                <span>{Math.round((cat.rules / totalRules) * 100)}%</span>
              </div>
              <Progress 
                value={(cat.rules / totalRules) * 100} 
                className="h-1.5"
              />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
