import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import { VariableSelectorPopup } from '@/components/proposals/VariableSelectorPopup';
import { FileText, Scale, MessageSquare } from 'lucide-react';

interface TemplateContentTabProps {
  introduction: string;
  terms: string;
  observations: string;
  onIntroductionChange: (value: string) => void;
  onTermsChange: (value: string) => void;
  onObservationsChange: (value: string) => void;
}

export function TemplateContentTab({
  introduction,
  terms,
  observations,
  onIntroductionChange,
  onTermsChange,
  onObservationsChange,
}: TemplateContentTabProps) {
  const handleInsertVariable = (
    variable: string,
    setter: (value: string) => void,
    currentValue: string
  ) => {
    setter(currentValue + variable);
  };

  return (
    <div className="space-y-6">
      {/* Introduction */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              <div>
                <CardTitle>Introdução</CardTitle>
                <CardDescription>Texto de abertura da proposta comercial</CardDescription>
              </div>
            </div>
            <VariableSelectorPopup 
              onSelectVariable={(v) => handleInsertVariable(v, onIntroductionChange, introduction)} 
            />
          </div>
        </CardHeader>
        <CardContent>
          <RichTextEditor
            value={introduction}
            onChange={onIntroductionChange}
            placeholder="Ex: Prezado(a) {{contato_nome}}, é com grande satisfação que apresentamos nossa proposta comercial..."
            minHeight="200px"
          />
        </CardContent>
      </Card>

      {/* Terms */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Scale className="h-5 w-5 text-primary" />
              <div>
                <CardTitle>Termos e Condições</CardTitle>
                <CardDescription>Condições gerais de fornecimento e pagamento</CardDescription>
              </div>
            </div>
            <VariableSelectorPopup 
              onSelectVariable={(v) => handleInsertVariable(v, onTermsChange, terms)} 
            />
          </div>
        </CardHeader>
        <CardContent>
          <RichTextEditor
            value={terms}
            onChange={onTermsChange}
            placeholder="Ex: 1. Validade da proposta: {{proposta_validade}}&#10;2. Forma de pagamento: conforme acordado..."
            minHeight="200px"
          />
        </CardContent>
      </Card>

      {/* Observations */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" />
              <div>
                <CardTitle>Observações</CardTitle>
                <CardDescription>Notas adicionais e dicas para o cliente</CardDescription>
              </div>
            </div>
            <VariableSelectorPopup 
              onSelectVariable={(v) => handleInsertVariable(v, onObservationsChange, observations)} 
            />
          </div>
        </CardHeader>
        <CardContent>
          <RichTextEditor
            value={observations}
            onChange={onObservationsChange}
            placeholder="Ex: Observações importantes sobre o produto/serviço..."
            minHeight="150px"
          />
        </CardContent>
      </Card>
    </div>
  );
}
