import { Phone, Video, Mail, MessageCircle, CheckSquare, FileText, LucideIcon } from 'lucide-react';

interface ActivityTypeIconProps {
  type: 'call' | 'meeting' | 'email' | 'whatsapp' | 'task' | 'note';
  className?: string;
}

const iconMap: Record<string, LucideIcon> = {
  call: Phone,
  meeting: Video,
  email: Mail,
  whatsapp: MessageCircle,
  task: CheckSquare,
  note: FileText,
};

export function ActivityTypeIcon({ type, className = "h-4 w-4" }: ActivityTypeIconProps) {
  const Icon = iconMap[type] || FileText;
  return <Icon className={className} />;
}
