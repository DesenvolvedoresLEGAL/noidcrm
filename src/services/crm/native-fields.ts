// Native fields available for custom forms

export interface NativeField {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'number' | 'currency' | 'date' | 'datetime' | 'boolean' | 'select' | 'email' | 'phone' | 'url';
  options?: { value: string; label: string }[];
}

export const NATIVE_FIELDS: Record<string, NativeField[]> = {
  opportunity: [
    { key: 'title', label: 'Título da oportunidade', type: 'text' },
    { key: 'valor_previsto', label: 'Valor de P&S', type: 'currency' },
    { key: 'valor_mrr', label: 'Valor de MRR', type: 'currency' },
    { key: 'prob', label: 'Probabilidade (%)', type: 'number' },
    { 
      key: 'temperature', 
      label: 'Temperatura', 
      type: 'select',
      options: [
        { value: 'cold', label: 'Frio' },
        { value: 'warm', label: 'Morno' },
        { value: 'hot', label: 'Quente' },
        { value: 'burning', label: 'Queimando' },
      ]
    },
    { key: 'close_date_prevista', label: 'Previsão de fechamento', type: 'date' },
    { key: 'observacao', label: 'Observação', type: 'textarea' },
    { key: 'next_step', label: 'Próximo passo', type: 'textarea' },
  ],
  account: [
    { key: 'razao_social', label: 'Razão Social', type: 'text' },
    { key: 'nome_fantasia', label: 'Nome Fantasia', type: 'text' },
    { key: 'cnpj', label: 'CNPJ', type: 'text' },
    { key: 'segmento', label: 'Segmento', type: 'text' },
    { key: 'cnae', label: 'CNAE', type: 'text' },
    { key: 'tamanho', label: 'Tamanho', type: 'text' },
    { key: 'origem_principal', label: 'Origem Principal', type: 'text' },
    { key: 'inscricao_estadual', label: 'Inscrição Estadual', type: 'text' },
    { key: 'inscricao_municipal', label: 'Inscrição Municipal', type: 'text' },
    { key: 'logradouro', label: 'Logradouro', type: 'text' },
    { key: 'numero', label: 'Número', type: 'text' },
    { key: 'complemento', label: 'Complemento', type: 'text' },
    { key: 'bairro', label: 'Bairro', type: 'text' },
    { key: 'cidade', label: 'Cidade', type: 'text' },
    { key: 'uf', label: 'UF', type: 'text' },
    { key: 'cep', label: 'CEP', type: 'text' },
    { key: 'website', label: 'Website', type: 'url' },
    { key: 'linkedin', label: 'LinkedIn', type: 'url' },
    { key: 'instagram', label: 'Instagram', type: 'url' },
    { key: 'facebook', label: 'Facebook', type: 'url' },
    { key: 'observacoes', label: 'Observações', type: 'textarea' },
  ],
  contact: [
    { key: 'nome', label: 'Nome completo', type: 'text' },
    { key: 'cargo', label: 'Cargo', type: 'text' },
    { key: 'departamento', label: 'Departamento', type: 'text' },
    { key: 'primary_email', label: 'E-mail principal', type: 'email' },
    { key: 'emails', label: 'E-mails (todos)', type: 'text' },
    { key: 'primary_phone', label: 'Telefone principal', type: 'phone' },
    { key: 'telefones', label: 'Telefones (todos)', type: 'text' },
    { key: 'linkedin', label: 'LinkedIn', type: 'url' },
    { key: 'observacoes', label: 'Observações', type: 'textarea' },
  ]
};

export function getNativeFieldsByEntity(entityType: string): NativeField[] {
  return NATIVE_FIELDS[entityType] || [];
}

export function getNativeFieldLabel(entityType: string, fieldKey: string): string {
  const fields = NATIVE_FIELDS[entityType] || [];
  const field = fields.find(f => f.key === fieldKey);
  return field?.label || fieldKey;
}
