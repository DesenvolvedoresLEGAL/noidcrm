import { motion } from "framer-motion";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Crown, Shield, Users, Target, Sparkles, Calendar, Clock } from "lucide-react";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

export interface DashboardHeaderProps {
  role: "owner" | "admin" | "manager" | "sales" | "cs" | "finance";
  title: string;
  subtitle: string;
}

const roleConfig = {
  owner: {
    icon: Crown,
    accentColor: "text-amber-500",
    bgColor: "from-amber-500/10 to-orange-500/5",
    borderColor: "border-amber-500/20",
    badge: "CEO",
    badgeClass: "bg-amber-500/10 text-amber-600 border-amber-500/30",
  },
  admin: {
    icon: Shield,
    accentColor: "text-emerald-500",
    bgColor: "from-emerald-500/10 to-teal-500/5",
    borderColor: "border-emerald-500/20",
    badge: "Admin",
    badgeClass: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
  },
  manager: {
    icon: Users,
    accentColor: "text-indigo-500",
    bgColor: "from-indigo-500/10 to-purple-500/5",
    borderColor: "border-indigo-500/20",
    badge: "Gerente",
    badgeClass: "bg-indigo-500/10 text-indigo-600 border-indigo-500/30",
  },
  cs: {
    icon: Users,
    accentColor: "text-teal-500",
    bgColor: "from-teal-500/10 to-cyan-500/5",
    borderColor: "border-teal-500/20",
    badge: "Customer Success",
    badgeClass: "bg-teal-500/10 text-teal-600 border-teal-500/30",
  },
  finance: {
    icon: Shield,
    accentColor: "text-blue-500",
    bgColor: "from-blue-500/10 to-indigo-500/5",
    borderColor: "border-blue-500/20",
    badge: "Financeiro",
    badgeClass: "bg-blue-500/10 text-blue-600 border-blue-500/30",
  },
  sales: {
    icon: Target,
    accentColor: "text-primary",
    bgColor: "from-primary/10 to-accent/5",
    borderColor: "border-primary/20",
    badge: "Vendedor",
    badgeClass: "bg-primary/10 text-primary border-primary/30",
  },
};

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

function formatDate(): string {
  return new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function formatTime(): string {
  return new Date().toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function DashboardHeader({ role, title, subtitle }: DashboardHeaderProps) {
  const { profile } = useCurrentUser();
  const [currentTime, setCurrentTime] = useState(formatTime());
  const config = roleConfig[role];
  const Icon = config.icon;

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(formatTime());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const firstName = profile?.full_name?.split(" ")[0] || "Usuário";
  const initials = profile?.full_name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "U";

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className={cn(
        "relative overflow-hidden rounded-2xl border p-6",
        "bg-gradient-to-br backdrop-blur-xl",
        config.bgColor,
        config.borderColor,
        "shadow-card"
      )}
    >
      {/* Background decoration */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-primary/5 to-transparent rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
      <div className="absolute bottom-0 left-0 w-48 h-48 bg-gradient-to-tr from-accent/5 to-transparent rounded-full blur-2xl translate-y-1/2 -translate-x-1/2" />

      <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Left Section */}
        <div className="flex items-center gap-4">
          {/* Avatar with glow */}
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.4 }}
            className="relative"
          >
            <div className={cn("absolute inset-0 rounded-full blur-lg opacity-50", config.accentColor.replace("text-", "bg-"))} />
            <Avatar className="h-14 w-14 border-2 border-background shadow-lg relative">
              <AvatarImage src={profile?.avatar_url || undefined} />
              <AvatarFallback className={cn("text-lg font-semibold", config.accentColor)}>
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-green-500 border-2 border-background flex items-center justify-center">
              <span className="sr-only">Online</span>
            </div>
          </motion.div>

          {/* Title and greeting */}
          <div className="space-y-1">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
              className="flex items-center gap-2"
            >
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
                {getGreeting()}, {firstName}!
              </h1>
              <Sparkles className={cn("h-5 w-5", config.accentColor)} />
            </motion.div>
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 }}
              className="flex items-center gap-2 text-muted-foreground"
            >
              <Icon className={cn("h-4 w-4", config.accentColor)} />
              <span className="text-sm font-medium">{title}</span>
              <span className="text-muted-foreground/50">•</span>
              <span className="text-sm">{subtitle}</span>
            </motion.div>
          </div>
        </div>

        {/* Right Section */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.5 }}
          className="flex items-center gap-4"
        >
          {/* Date/Time */}
          <div className="hidden md:flex flex-col items-end text-sm">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Calendar className="h-3.5 w-3.5" />
              <span className="capitalize">{formatDate()}</span>
            </div>
            <div className="flex items-center gap-1.5 font-semibold">
              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
              <span>{currentTime}</span>
            </div>
          </div>

          {/* Role Badge */}
          <Badge
            variant="outline"
            className={cn(
              "px-3 py-1.5 text-xs font-semibold uppercase tracking-wider",
              config.badgeClass
            )}
          >
            <Icon className="h-3 w-3 mr-1.5" />
            {config.badge}
          </Badge>
        </motion.div>
      </div>
    </motion.div>
  );
}
