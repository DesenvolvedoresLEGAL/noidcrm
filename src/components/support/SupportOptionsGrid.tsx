import { Search, MessageSquare, AlertTriangle, Users, Activity } from 'lucide-react';
import { SupportOptionCard } from './SupportOptionCard';
import { useNavigate } from 'react-router-dom';

interface SupportOptionsGridProps {
  onOpenTicketDialog: (type?: 'bug' | 'question') => void;
}

export function SupportOptionsGrid({ onOpenTicketDialog }: SupportOptionsGridProps) {
  const navigate = useNavigate();

  const options = [
    {
      icon: Search,
      title: 'Buscar na Documentação',
      description: 'Encontre respostas rápidas em nossa base de conhecimento',
      onClick: () => navigate('/app/docs'),
      variant: 'default' as const,
    },
    {
      icon: MessageSquare,
      title: 'Abrir um chamado',
      description: 'Crie uma solicitação para nossa equipe de suporte',
      onClick: () => onOpenTicketDialog(),
      variant: 'primary' as const,
    },
    {
      icon: AlertTriangle,
      title: 'Reportar problema técnico',
      description: 'Relate bugs ou erros que você encontrou',
      onClick: () => onOpenTicketDialog('bug'),
      variant: 'warning' as const,
    },
    {
      icon: Users,
      title: 'Falar com especialista',
      description: 'Agende uma sessão com nosso time de sucesso',
      onClick: () => window.open('https://calendly.com/noid', '_blank'),
      variant: 'success' as const,
    },
    {
      icon: Activity,
      title: 'Status da Plataforma',
      description: 'Verifique a disponibilidade dos serviços',
      onClick: () => {},
      variant: 'default' as const,
      disabled: true,
      badge: 'Em breve',
    },
  ];

  return (
    <section className="py-8">
      <div className="container max-w-5xl mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {options.map((option, index) => (
            <SupportOptionCard
              key={option.title}
              {...option}
              index={index}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
