import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Building2 } from 'lucide-react';

interface Step1Props {
  onNext: (data: Step1Data) => void;
}

export interface Step1Data {
  companyName: string;
  industry: string;
  teamSize: string;
  cnpj?: string;
}

const INDUSTRIES = [
  'Tecnologia',
  'Serviços Financeiros',
  'Saúde',
  'Educação',
  'Varejo',
  'Manufatura',
  'Imobiliário',
  'Consultoria',
  'Marketing e Publicidade',
  'Outro'
];

const TEAM_SIZES = [
  'Apenas eu',
  '2-5 pessoas',
  '6-10 pessoas',
  '11-25 pessoas',
  '26-50 pessoas',
  '51+ pessoas'
];

export function Step1Company({ onNext }: Step1Props) {
  const [formData, setFormData] = useState<Step1Data>({
    companyName: '',
    industry: '',
    teamSize: '',
    cnpj: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onNext(formData);
  };

  const isValid = formData.companyName.length >= 2 && formData.industry && formData.teamSize;

  return (
    <Card className="border-2 shadow-xl animate-fade-in">
      <CardContent className="pt-12 pb-8 px-8">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Building2 className="w-8 h-8 text-primary" />
          </div>
          <h2 className="text-3xl font-bold mb-2">Vamos começar! 🚀</h2>
          <p className="text-lg text-muted-foreground">
            Conte-nos sobre sua empresa
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="companyName">Nome da empresa *</Label>
            <Input
              id="companyName"
              placeholder="Ex: Acme Corporation"
              value={formData.companyName}
              onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
              className="h-11"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="industry">Segmento *</Label>
            <Select value={formData.industry} onValueChange={(value) => setFormData({ ...formData, industry: value })}>
              <SelectTrigger id="industry" className="h-11">
                <SelectValue placeholder="Selecione seu segmento" />
              </SelectTrigger>
              <SelectContent>
                {INDUSTRIES.map((industry) => (
                  <SelectItem key={industry} value={industry}>
                    {industry}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="teamSize">Tamanho do time *</Label>
            <Select value={formData.teamSize} onValueChange={(value) => setFormData({ ...formData, teamSize: value })}>
              <SelectTrigger id="teamSize" className="h-11">
                <SelectValue placeholder="Quantas pessoas?" />
              </SelectTrigger>
              <SelectContent>
                {TEAM_SIZES.map((size) => (
                  <SelectItem key={size} value={size}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="cnpj">CNPJ (opcional)</Label>
            <Input
              id="cnpj"
              placeholder="00.000.000/0000-00"
              value={formData.cnpj}
              onChange={(e) => setFormData({ ...formData, cnpj: e.target.value })}
              className="h-11"
            />
          </div>

          <Button type="submit" size="lg" className="w-full h-12 text-base" disabled={!isValid}>
            Continuar →
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
