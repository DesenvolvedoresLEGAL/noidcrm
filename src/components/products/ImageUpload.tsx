import { useState } from 'react';
import { Upload, X, Loader2, Link as LinkIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface ImageUploadProps {
  value: string;
  onChange: (url: string) => void;
  organizationId: string;
}

export function ImageUpload({ value, onChange, organizationId }: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [urlInput, setUrlInput] = useState(value || '');
  const { toast } = useToast();

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const file = event.target.files?.[0];
      if (!file) return;

      // Validar tipo de arquivo
      if (!file.type.startsWith('image/')) {
        toast({
          variant: 'destructive',
          title: 'Arquivo inválido',
          description: 'Por favor, selecione uma imagem.',
        });
        return;
      }

      // Validar tamanho (máximo 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast({
          variant: 'destructive',
          title: 'Arquivo muito grande',
          description: 'O tamanho máximo é 5MB.',
        });
        return;
      }

      setUploading(true);

      // Gerar nome único para o arquivo
      const fileExt = file.name.split('.').pop();
      const fileName = `${organizationId}/${Date.now()}.${fileExt}`;

      // Upload para o Supabase Storage
      const { data, error } = await supabase.storage
        .from('product-images')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (error) throw error;

      // Obter URL pública
      const { data: { publicUrl } } = supabase.storage
        .from('product-images')
        .getPublicUrl(data.path);

      onChange(publicUrl);
      setUrlInput(publicUrl);

      toast({
        title: 'Imagem enviada',
        description: 'A imagem foi carregada com sucesso.',
      });
    } catch (error: any) {
      console.error('Error uploading image:', error);
      toast({
        variant: 'destructive',
        title: 'Erro no upload',
        description: error.message || 'Não foi possível enviar a imagem.',
      });
    } finally {
      setUploading(false);
    }
  };

  const handleUrlSubmit = () => {
    if (urlInput) {
      onChange(urlInput);
      toast({
        title: 'URL adicionada',
        description: 'A URL da imagem foi salva.',
      });
    }
  };

  const handleRemove = () => {
    onChange('');
    setUrlInput('');
  };

  return (
    <div className="space-y-4">
      {value ? (
        <div className="relative border-2 border-dashed rounded-lg p-4 bg-muted/50">
          <img
            src={value}
            alt="Preview"
            className="w-full h-48 object-cover rounded"
            onError={(e) => {
              e.currentTarget.src = 'https://via.placeholder.com/400x300?text=Erro+ao+carregar';
            }}
          />
          <Button
            type="button"
            variant="destructive"
            size="sm"
            className="absolute top-6 right-6"
            onClick={handleRemove}
          >
            <X className="h-4 w-4 mr-1" />
            Remover
          </Button>
        </div>
      ) : (
        <Tabs defaultValue="upload" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="upload">
              <Upload className="h-4 w-4 mr-2" />
              Upload
            </TabsTrigger>
            <TabsTrigger value="url">
              <LinkIcon className="h-4 w-4 mr-2" />
              URL
            </TabsTrigger>
          </TabsList>

          <TabsContent value="upload" className="space-y-4">
            <div className="border-2 border-dashed rounded-lg p-8 text-center bg-muted/50 hover:bg-muted/70 transition-colors">
              <input
                type="file"
                id="image-upload"
                accept="image/*"
                onChange={handleFileUpload}
                disabled={uploading}
                className="hidden"
              />
              <label htmlFor="image-upload" className="cursor-pointer">
                {uploading ? (
                  <Loader2 className="h-12 w-12 mx-auto text-muted-foreground animate-spin" />
                ) : (
                  <Upload className="h-12 w-12 mx-auto text-muted-foreground" />
                )}
                <p className="mt-2 text-sm text-muted-foreground">
                  {uploading ? 'Enviando...' : 'Clique para selecionar uma imagem'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  PNG, JPG, WEBP até 5MB
                </p>
              </label>
            </div>
          </TabsContent>

          <TabsContent value="url" className="space-y-4">
            <div>
              <Label htmlFor="image-url">URL da Imagem</Label>
              <div className="flex gap-2 mt-2">
                <Input
                  id="image-url"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="https://exemplo.com/imagem.jpg"
                />
                <Button
                  type="button"
                  onClick={handleUrlSubmit}
                  disabled={!urlInput}
                >
                  Adicionar
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
