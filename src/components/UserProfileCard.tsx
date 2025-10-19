import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useUserSensitive } from '@/hooks/useUserSensitive';
import { Camera, Save, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';

export function UserProfileCard() {
  const { user, sensitive } = useUserSensitive();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    displayName: user?.displayName || '',
    email: user?.email || '',
    photoURL: user?.photoURL || '',
  });

  const handleSave = () => {
    // TODO: Implementar atualização do perfil no Firebase/Supabase
    toast({
      title: 'Perfil atualizado',
      description: 'Suas informações foram salvas com sucesso.',
    });
    setIsEditing(false);
  };

  const handleCancel = () => {
    setFormData({
      displayName: user?.displayName || '',
      email: user?.email || '',
      photoURL: user?.photoURL || '',
    });
    setIsEditing(false);
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getRoleLabel = (role?: string) => {
    const roleMap: Record<string, string> = {
      admin: 'Administrador',
      vendas: 'Vendas',
      cs: 'Customer Success',
      gestao: 'Gestão',
    };
    return roleMap[role || ''] || 'Usuário';
  };

  const getRoleVariant = (role?: string): "default" | "secondary" | "destructive" | "outline" => {
    const variantMap: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      admin: 'destructive',
      gestao: 'default',
      vendas: 'secondary',
      cs: 'outline',
    };
    return variantMap[role || ''] || 'outline';
  };

  return (
    <Card className="shadow-card hover:shadow-card-hover transition-shadow">
      <CardHeader>
        <CardTitle className="text-lg">Perfil do Usuário</CardTitle>
        <CardDescription>
          Gerencie suas informações pessoais e preferências
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Avatar Section */}
        <div className="flex items-center gap-6">
          <div className="relative">
            <Avatar className="h-24 w-24">
              <AvatarImage src={formData.photoURL} alt={formData.displayName} />
              <AvatarFallback className="text-2xl font-bold bg-primary/10 text-primary">
                {getInitials(formData.displayName || user?.email || 'U')}
              </AvatarFallback>
            </Avatar>
            {isEditing && (
              <Button
                size="icon"
                variant="secondary"
                className="absolute bottom-0 right-0 h-8 w-8 rounded-full"
              >
                <Camera className="h-4 w-4" />
              </Button>
            )}
          </div>
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <h3 className="text-xl font-bold text-foreground">
                {user?.displayName || 'Sem nome'}
              </h3>
              <Badge variant={getRoleVariant(sensitive?.role)}>
                {getRoleLabel(sensitive?.role)}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">{user?.email}</p>
            <p className="text-xs text-muted-foreground">
              ID: {user?.uid?.slice(0, 8)}...
            </p>
          </div>
        </div>

        {/* Form Section */}
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="displayName">Nome Completo</Label>
            <Input
              id="displayName"
              value={formData.displayName}
              onChange={(e) =>
                setFormData({ ...formData, displayName: e.target.value })
              }
              disabled={!isEditing}
              placeholder="Seu nome completo"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) =>
                setFormData({ ...formData, email: e.target.value })
              }
              disabled={!isEditing}
              placeholder="seu@email.com"
            />
          </div>

          <div className="space-y-2">
            <Label>Função</Label>
            <Input value={getRoleLabel(sensitive?.role)} disabled />
          </div>

          {sensitive?.times && sensitive.times.length > 0 && (
            <div className="space-y-2">
              <Label>Times</Label>
              <div className="flex flex-wrap gap-2">
                {sensitive.times.map((time) => (
                  <Badge key={time} variant="outline">
                    {time}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {sensitive?.territorios && sensitive.territorios.length > 0 && (
            <div className="space-y-2">
              <Label>Territórios</Label>
              <div className="flex flex-wrap gap-2">
                {sensitive.territorios.map((territorio) => (
                  <Badge key={territorio} variant="outline">
                    {territorio}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 pt-4">
          {isEditing ? (
            <>
              <Button onClick={handleSave} className="flex-1">
                <Save className="mr-2 h-4 w-4" />
                Salvar Alterações
              </Button>
              <Button onClick={handleCancel} variant="outline" className="flex-1">
                <X className="mr-2 h-4 w-4" />
                Cancelar
              </Button>
            </>
          ) : (
            <Button onClick={() => setIsEditing(true)} className="w-full">
              Editar Perfil
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
