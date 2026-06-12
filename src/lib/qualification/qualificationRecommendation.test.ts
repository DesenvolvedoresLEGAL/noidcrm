import { describe, expect, it } from 'vitest';
import { getQualificationRecommendation } from './qualificationRecommendation';
import { computeQualificationScore } from './qualificationScore';

describe('getQualificationRecommendation', () => {
  it('prioritizes permissão real over other blockers', () => {
    const result = computeQualificationScore(
      {
        nome_evento: 'Evento X',
        data_evento: '2026-12-01',
        local_evento: 'SP',
        conexoes_simultaneas: 100,
        equipamentos: 'router',
        finalidade_uso: 'wifi',
        urgencia_real: 'ate_3_dias',
        poder_decisao: 'decisor_final',
        proximo_passo: 'enviar_proposta',
        permissao_proposta: 'sem_permissao',
      },
      { hasAccount: true, hasContact: true }
    );
    const rec = getQualificationRecommendation(result);
    expect(rec.title).toMatch(/Validar decisor/i);
  });

  it('falls back to poder when permissão is valid but poder is missing', () => {
    const result = computeQualificationScore(
      {
        nome_evento: 'E',
        data_evento: 'd',
        local_evento: 'l',
        conexoes_simultaneas: 1,
        equipamentos: 'x',
        finalidade_uso: 'y',
        urgencia_real: 'ate_3_dias',
        proximo_passo: 'enviar_proposta',
        permissao_proposta: 'cliente_pediu_proposta',
      },
      { hasAccount: true, hasContact: true }
    );
    const rec = getQualificationRecommendation(result);
    expect(rec.title).toMatch(/decisor real/i);
  });

  it('returns ready-for-sales when canMoveToSales', () => {
    const result = computeQualificationScore(
      {
        nome_evento: 'E',
        data_evento: 'd',
        local_evento: 'l',
        conexoes_simultaneas: 1,
        equipamentos: 'x',
        finalidade_uso: 'y',
        urgencia_real: 'ate_3_dias',
        poder_decisao: 'decisor_final',
        proximo_passo: 'enviar_proposta',
        permissao_proposta: 'cliente_pediu_proposta',
      },
      { hasAccount: true, hasContact: true }
    );
    expect(result.canMoveToSales).toBe(true);
    const rec = getQualificationRecommendation(result);
    expect(rec.title).toMatch(/pronto para Vendas/i);
  });

  it('returns immature lead message when score < 60 and account/contact missing', () => {
    const result = computeQualificationScore({}, { hasAccount: false, hasContact: false });
    const rec = getQualificationRecommendation(result);
    // hasAccount/hasContact missing dominate priority chain before "imaturo"
    expect(rec.title).toMatch(/empresa e contato|imaturo|Mapear evento|demanda técnica/i);
  });
});
