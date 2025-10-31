import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, Printer, Share2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface ProposalPDFViewerProps {
  pdfUrl: string;
  proposalTitle?: string;
}

export function ProposalPDFViewer({ pdfUrl, proposalTitle }: ProposalPDFViewerProps) {
  const handleDownload = () => {
    window.open(pdfUrl, '_blank');
    toast.success('PDF baixado!');
  };

  const handlePrint = () => {
    const printWindow = window.open(pdfUrl, '_blank');
    if (printWindow) {
      printWindow.addEventListener('load', () => {
        printWindow.print();
      });
    }
  };

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(pdfUrl);
      toast.success('Link copiado para a área de transferência!');
    } catch (error) {
      toast.error('Erro ao copiar link');
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>{proposalTitle || 'Visualização da Proposta'}</CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleDownload}>
              <Download className="h-4 w-4 mr-2" />
              Baixar
            </Button>
            <Button variant="outline" size="sm" onClick={handlePrint}>
              <Printer className="h-4 w-4 mr-2" />
              Imprimir
            </Button>
            <Button variant="outline" size="sm" onClick={handleShare}>
              <Share2 className="h-4 w-4 mr-2" />
              Compartilhar
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="relative w-full" style={{ height: '600px' }}>
          <iframe
            src={pdfUrl}
            className="w-full h-full border rounded-lg"
            title="Proposta PDF"
          />
        </div>
      </CardContent>
    </Card>
  );
}
