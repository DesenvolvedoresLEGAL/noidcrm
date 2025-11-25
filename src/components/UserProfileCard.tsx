import { useState, useEffect, useRef } from 'react';
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
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export function UserProfileCard() {
  const { user } = useSupabaseAuth();
  const { profile, updateProfile } = useUserProfile();
  const { roles, loading: rolesLoading } = useUserRole();
  const [isEditing, setIsEditing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
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

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Por favor, selecione uma imagem válida');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Imagem muito grande. Tamanho máximo: 5MB');
      return;
    }

    setUploading(true);
    try {
      // Upload to Supabase Storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${user?.id}-${Date.now()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      // Update profile with new avatar URL
      const result = await updateProfile({
        avatar_url: publicUrl,
      });

      if (result.error) {
        toast.error('Erro ao atualizar perfil');
      } else {
        setFormData({ ...formData, photoURL: publicUrl });
        toast.success('Foto atualizada com sucesso');
      }
    } catch (error) {
      console.error('Error uploading avatar:', error);
      toast.error('Erro ao fazer upload da foto');
    } finally {
      setUploading(false);
    }
  };

  const handleAvatarClick = () => {
    if (isEditing) {
      fileInputRef.current?.click();
    }
  };

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
            <Avatar 
              className="h-24 w-24 cursor-pointer hover:opacity-80 transition-opacity"
              onClick={handleAvatarClick}
            >
              <AvatarImage src={formData.photoURL} alt={formData.displayName} />
              <AvatarFallback className="text-2xl font-bold bg-primary/10 text-primary">
                {getInitials(formData.displayName || user?.email || 'U')}
              </AvatarFallback>
            </Avatar>
            {isEditing && (
              <Button
                size="icon"
                variant="secondary"
                className="absolute bottom-0 right-0 h-8 w-8 rounded-full pointer-events-none"
                disabled={uploading}
              >
                <Camera className="h-4 w-4" />
              </Button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
            />
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
          
          {isEditing && (
            <p className="text-sm text-muted-foreground">
              Clique no avatar acima para alterar sua foto de perfil
            </p>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 pt-4">
          {isEditing ? (
            <>
              <Button onClick={handleSave} className="flex-1" disabled={uploading}>
                <Save className="mr-2 h-4 w-4" />
                Salvar Alterações
              </Button>
              <Button onClick={handleCancel} variant="outline" className="flex-1" disabled={uploading}>
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
