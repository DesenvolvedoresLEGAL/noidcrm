import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { FileIcon, Upload, Download, Trash2, File } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  listOpportunityFiles,
  uploadOpportunityFile,
  downloadOpportunityFile,
  deleteOpportunityFile,
  formatFileSize,
  type OpportunityFile,
} from '@/services/crm/opportunity-files';

interface OpportunityFilesTabProps {
  opportunityId: string;
}

export function OpportunityFilesTab({ opportunityId }: OpportunityFilesTabProps) {
  const { toast } = useToast();
  const [files, setFiles] = useState<OpportunityFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadFiles = async () => {
    try {
      setLoading(true);
      const data = await listOpportunityFiles(opportunityId);
      setFiles(data);
    } catch (error) {
      console.error('Erro ao carregar arquivos:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar os arquivos.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFiles();
  }, [opportunityId]);

  const handleFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = event.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;

    try {
      setUploading(true);
      
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        
        // Validate file size (max 20MB)
        if (file.size > 20 * 1024 * 1024) {
          toast({
            title: 'Erro',
            description: `${file.name} é muito grande. Tamanho máximo: 20MB`,
            variant: 'destructive',
          });
          continue;
        }

        await uploadOpportunityFile(opportunityId, file);
      }

      toast({
        title: 'Sucesso',
        description: `${selectedFiles.length} arquivo(s) enviado(s) com sucesso!`,
      });

      loadFiles();
      
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error('Erro ao fazer upload:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível fazer upload dos arquivos.',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (file: OpportunityFile) => {
    try {
      await downloadOpportunityFile(file);
      toast({
        title: 'Sucesso',
        description: 'Download iniciado!',
      });
    } catch (error) {
      console.error('Erro ao fazer download:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível fazer download do arquivo.',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (file: OpportunityFile) => {
    if (!confirm(`Tem certeza que deseja excluir "${file.file_name}"?`)) return;

    try {
      await deleteOpportunityFile(file);
      toast({
        title: 'Sucesso',
        description: 'Arquivo excluído com sucesso!',
      });
      loadFiles();
    } catch (error) {
      console.error('Erro ao excluir arquivo:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível excluir o arquivo.',
        variant: 'destructive',
      });
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      return format(parseISO(dateStr), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
    } catch {
      return dateStr;
    }
  };

  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith('image/')) return '🖼️';
    if (fileType.startsWith('video/')) return '🎥';
    if (fileType.startsWith('audio/')) return '🎵';
    if (fileType.includes('pdf')) return '📄';
    if (fileType.includes('word') || fileType.includes('document')) return '📝';
    if (fileType.includes('sheet') || fileType.includes('excel')) return '📊';
    if (fileType.includes('presentation') || fileType.includes('powerpoint')) return '📽️';
    if (fileType.includes('zip') || fileType.includes('rar') || fileType.includes('tar')) return '📦';
    return '📎';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <FileIcon className="h-5 w-5" />
              Arquivos da Oportunidade
            </CardTitle>
            <Button onClick={handleFileSelect} disabled={uploading} size="sm">
              <Upload className="h-4 w-4 mr-2" />
              {uploading ? 'Enviando...' : 'Enviar Arquivos'}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={handleFileUpload}
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {files.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <File className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p className="text-lg font-medium">Nenhum arquivo encontrado</p>
              <p className="text-sm mt-2">
                Clique em "Enviar Arquivos" para adicionar documentos a esta oportunidade.
              </p>
            </div>
          ) : (
            <div className="grid gap-3">
              {files.map((file) => (
                <Card key={file.id} className="hover:bg-accent/50 transition-colors">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      <div className="text-4xl">{getFileIcon(file.file_type)}</div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate">{file.file_name}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                          <span>{formatFileSize(file.file_size)}</span>
                          <span>•</span>
                          <Avatar className="h-4 w-4">
                            <AvatarFallback className="text-[8px]">
                              {file.uploader?.full_name?.charAt(0).toUpperCase() || '?'}
                            </AvatarFallback>
                          </Avatar>
                          <span>{file.uploader?.full_name || 'Usuário'}</span>
                          <span>•</span>
                          <span>{formatDate(file.created_at)}</span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDownload(file)}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={() => handleDelete(file)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
