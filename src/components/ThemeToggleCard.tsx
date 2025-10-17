import { Moon, Sun, Monitor, Check } from "lucide-react";
import { useTheme } from "next-themes";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function ThemeToggleCard() {
  const { setTheme, theme } = useTheme();

  const themes = [
    {
      value: "light",
      label: "Claro",
      description: "Tema clássico com fundo claro",
      icon: Sun,
    },
    {
      value: "dark",
      label: "Escuro",
      description: "Tema noturno com fundo escuro",
      icon: Moon,
    },
    {
      value: "system",
      label: "Sistema",
      description: "Usar tema do sistema operacional",
      icon: Monitor,
    },
  ];

  return (
    <Card className="shadow-card hover:shadow-card-hover transition-shadow">
      <CardHeader>
        <CardTitle className="text-lg">Aparência</CardTitle>
        <CardDescription>
          Escolha como o sistema deve aparecer para você
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {themes.map((item) => {
            const Icon = item.icon;
            const isActive = theme === item.value;

            return (
              <button
                key={item.value}
                onClick={() => setTheme(item.value)}
                className={cn(
                  "relative flex flex-col items-center gap-3 rounded-lg border-2 p-6 transition-all hover:shadow-md",
                  isActive
                    ? "border-primary bg-primary/5 shadow-sm"
                    : "border-border bg-card hover:border-muted-foreground/30"
                )}
              >
                {isActive && (
                  <div className="absolute top-2 right-2">
                    <Check className="h-5 w-5 text-primary" />
                  </div>
                )}
                <Icon
                  className={cn(
                    "h-8 w-8 transition-colors",
                    isActive ? "text-primary" : "text-muted-foreground"
                  )}
                />
                <div className="text-center">
                  <div className={cn("font-semibold", isActive && "text-primary")}>
                    {item.label}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {item.description}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
