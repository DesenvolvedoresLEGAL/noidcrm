import { SecurityCard } from '@/components/SecurityCard';

export default function SecuritySettings() {
  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-xl font-bold text-foreground">Segurança</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Gerencie suas configurações de segurança e autenticação
        </p>
      </div>
      
      <SecurityCard />
    </div>
  );
}
