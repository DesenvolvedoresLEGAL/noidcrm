import React from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { 
  Settings, 
  Download, 
  TrendingUp, 
  Receipt, 
  FileText,
  Target,
  CreditCard,
  FileSignature,
  Hash,
  BarChart3,
  Database,
  Users,
  Calendar,
  GraduationCap,
  Smartphone,
  Zap,
  Building2,
  Package,
  MessageSquare,
  Mail,
  Phone,
  Globe,
  Webhook,
  Shield,
  FileStack
} from 'lucide-react';

export interface SettingSection {
  id: string;
  label: string;
  icon: any;
  group?: string;
}

export const settingSections: SettingSection[] = [
  { id: 'dados', label: 'Dados', icon: Database, group: 'Conta' },
  { id: 'exportacoes', label: 'Exportações', icon: Download, group: 'Conta' },
  { id: 'forecast', label: 'Forecast', icon: TrendingUp, group: 'Conta' },
  { id: 'impostos', label: 'Impostos', icon: Receipt, group: 'Conta' },
  { id: 'notas', label: 'Notas', icon: FileText, group: 'Conta' },
  
  { id: 'oportunidades', label: 'Oportunidades', icon: Target, group: 'Oportunidades' },
  { id: 'oportunidades-cartoes', label: 'Cards do Pipeline', icon: CreditCard, group: 'Oportunidades' },
  
  { id: 'propostas', label: 'Propostas', icon: FileSignature, group: 'Propostas' },
  { id: 'propostas-siglas', label: 'Siglas Sequenciais', icon: Hash, group: 'Propostas' },
  
  { id: 'relatorios', label: 'Relatórios', icon: BarChart3, group: 'Relatórios' },
];

interface SystemSettingsSidebarProps {
  activeSection: string;
  onSectionChange: (section: string) => void;
}

export function SystemSettingsSidebar({ activeSection, onSectionChange }: SystemSettingsSidebarProps) {
  const groups = Array.from(new Set(settingSections.map(s => s.group).filter(Boolean)));

  return (
    <div className="w-64 border-r bg-card h-full flex flex-col">
      <div className="p-4 border-b">
        <h3 className="font-semibold text-sm text-muted-foreground">Configurações do Sistema</h3>
      </div>
      
      <ScrollArea className="flex-1">
        <div className="p-2">
          {groups.map((group) => {
            const groupSections = settingSections.filter(s => s.group === group);
            
            return (
              <div key={group} className="mb-6">
                <h4 className="px-3 mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {group}
                </h4>
                <div className="space-y-1">
                  {groupSections.map((section) => {
                    const Icon = section.icon;
                    const isActive = activeSection === section.id;
                    
                    return (
                      <button
                        key={section.id}
                        onClick={() => onSectionChange(section.id)}
                        className={cn(
                          "w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                          isActive
                            ? "bg-primary text-primary-foreground font-medium"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        )}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        <span className="truncate">{section.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
