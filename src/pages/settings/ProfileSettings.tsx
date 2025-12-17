import { UserProfileCard } from '@/components/UserProfileCard';

export default function ProfileSettings() {
  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-xl font-bold text-foreground">Perfil</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Gerencie suas informações pessoais
        </p>
      </div>
      
      <UserProfileCard />
    </div>
  );
}
