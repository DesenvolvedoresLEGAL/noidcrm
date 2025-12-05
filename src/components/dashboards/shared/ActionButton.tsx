import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface ActionButtonProps {
  label: string;
  icon?: LucideIcon;
  onClick: () => void;
  variant?: "default" | "outline" | "secondary" | "ghost";
  size?: "default" | "sm" | "lg";
  className?: string;
  disabled?: boolean;
}

export function ActionButton({
  label,
  icon: Icon,
  onClick,
  variant = "default",
  size = "default",
  className,
  disabled = false,
}: ActionButtonProps) {
  return (
    <Button
      variant={variant}
      size={size}
      onClick={onClick}
      disabled={disabled}
      className={cn("gap-2", className)}
    >
      {Icon && <Icon className="h-4 w-4" />}
      {label}
    </Button>
  );
}
