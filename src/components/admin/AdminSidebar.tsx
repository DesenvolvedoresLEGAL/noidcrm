import { NavLink, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { 
  LayoutDashboard, 
  Building2, 
  Users, 
  DollarSign, 
  BarChart3, 
  FileText, 
  Shield, 
  Brain, 
  Server, 
  Settings,
  ChevronLeft,
  Zap,
  Activity,
  Trash2,
  TrendingUp,
  Scale,
  ShieldAlert
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

const menuItems = [
  { 
    path: "/admin", 
    label: "Command Center", 
    icon: LayoutDashboard,
    description: "Overview Executivo"
  },
  { 
    path: "/admin/control-room", 
    label: "Control Room", 
    icon: Activity,
    description: "Observabilidade"
  },
  { 
    path: "/admin/organizations", 
    label: "Organizações", 
    icon: Building2,
    description: "Contas & Tenants"
  },
  { 
    path: "/admin/users", 
    label: "Usuários", 
    icon: Users,
    description: "RBAC & Acessos"
  },
  { 
    path: "/admin/users/activity", 
    label: "Relatório Atividade", 
    icon: Activity,
    description: "Audit Log por Usuário"
  },
  { 
    path: "/admin/forensic", 
    label: "Exportação Forense", 
    icon: Scale,
    description: "Relatórios Judiciais"
  },
  {
    path: "/admin/revenue", 
    label: "Revenue", 
    icon: DollarSign,
    description: "Billing Intelligence"
  },
  {
    path: "/admin/revenue-integrity",
    label: "Revenue Integrity",
    icon: ShieldAlert,
    description: "SSoT vs superfícies"
  },
  { 
    path: "/admin/analytics", 
    label: "Analytics", 
    icon: BarChart3,
    description: "Product Insights"
  },
  { 
    path: "/admin/audit", 
    label: "Auditoria", 
    icon: Shield,
    description: "Compliance"
  },
  { 
    path: "/admin/trash", 
    label: "Lixeira", 
    icon: Trash2,
    description: "Itens deletados"
  },
  { 
    path: "/admin/backup", 
    label: "Backup", 
    icon: Server,
    description: "Backup & Recovery"
  },
  { 
    path: "/admin/ai", 
    label: "IA Control", 
    icon: Brain,
    description: "Automações & VOLTS"
  },
  { 
    path: "/admin/plg-score", 
    label: "PLG Score", 
    icon: TrendingUp,
    description: "Modelo de Score"
  },
  { 
    path: "/admin/infrastructure", 
    label: "Infraestrutura", 
    icon: Server,
    description: "Performance"
  },
  { 
    path: "/admin/settings", 
    label: "Configurações", 
    icon: Settings,
    description: "Sistema"
  },
];

export function AdminSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();

  return (
    <aside 
      className={cn(
        "h-screen border-r border-border bg-card/50 backdrop-blur-xl transition-all duration-300 flex flex-col",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Header */}
      <div className={cn(
        "h-16 border-b border-border flex items-center px-4",
        collapsed ? "justify-center" : "justify-between"
      )}>
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
              <Zap className="h-4 w-4 text-primary-foreground" />
            </div>
            <div>
              <p className="font-bold text-sm">NOID Admin</p>
              <p className="text-[10px] text-muted-foreground">Revenue OS</p>
            </div>
          </div>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => setCollapsed(!collapsed)}
        >
          <ChevronLeft className={cn(
            "h-4 w-4 transition-transform",
            collapsed && "rotate-180"
          )} />
        </Button>
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1 py-4">
        <nav className="space-y-1 px-2">
          {menuItems.map((item) => {
            const isActive = location.pathname === item.path || 
              (item.path !== "/admin" && location.pathname.startsWith(item.path));
            
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all group",
                  "hover:bg-accent/50",
                  isActive && "bg-primary/10 text-primary border border-primary/20",
                  !isActive && "text-muted-foreground hover:text-foreground"
                )}
              >
                <item.icon className={cn(
                  "h-5 w-5 shrink-0",
                  isActive && "text-primary"
                )} />
                {!collapsed && (
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{item.label}</p>
                    <p className="text-[10px] text-muted-foreground truncate">
                      {item.description}
                    </p>
                  </div>
                )}
              </NavLink>
            );
          })}
        </nav>
      </ScrollArea>

      {/* Footer */}
      <div className={cn(
        "border-t border-border p-4",
        collapsed && "flex justify-center"
      )}>
        <NavLink
          to="/app/dashboard"
          className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="h-3 w-3" />
          {!collapsed && <span>Voltar ao CRM</span>}
        </NavLink>
      </div>
    </aside>
  );
}
