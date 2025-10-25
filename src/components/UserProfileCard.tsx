import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Camera, Save, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useUserRole } from '@/hooks/useUserRole';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { toast } from 'sonner';

export function UserProfileCard() {
  const { user } = useSupabaseAuth();
  const { profile, updateProfile } = useUserProfile();
  const { roles, loading: rolesLoading } = useUserRole();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    displayName: '',
    photoURL: '',
  });

  useEffect(() => {
    if (profile) {
      setFormData({
        displayName: profile.full_name || '',
        photoURL: profile.avatar_url || '',
      });
    }
  }, [profile]);

  const handleSave = async () => {
    const result = await updateProfile({
      full_name: formData.displayName,
      avatar_url: formData.photoURL,
    });

    if (result.error) {
      toast.error('Erro ao atualizar perfil');
    } else {
      toast.success('Perfil atualizado com sucesso');
      setIsEditing(false);
    }
  };

  const handleCancel = () => {
    setFormData({
      displayName: profile?.full_name || '',
      photoURL: profile?.avatar_url || '',
    });
    setIsEditing(false);
  };

  const getInitials = (name: string) => {
    if (!name) return '';
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  if (!profile) return null;

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
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-xl font-bold text-foreground">
                {formData.displayName || 'Usuário'}
              </h3>
              {!rolesLoading && roles.map(role => (
                <Badge key={role} variant="default" className="capitalize">
                  {role}
                </Badge>
              ))}
            </div>
            <p className="text-sm text-muted-foreground">{user?.email}</p>
            <p className="text-xs text-muted-foreground">
              ID: {user?.id?.slice(0, 8)}...
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
            <Label htmlFor="photoURL">URL da Foto</Label>
            <Input
              id="photoURL"
              value={formData.photoURL}
              onChange={(e) =>
                setFormData({ ...formData, photoURL: e.target.value })
              }
              disabled={!isEditing}
              placeholder="https://exemplo.com/foto.jpg"
            />
          </div>
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
