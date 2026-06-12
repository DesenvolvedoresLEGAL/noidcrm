import { describe, it, expect } from 'vitest';
import { computeQualificationScore, classifyScore } from './qualificationScore';

const fullCtx = { hasAccount: true, hasContact: true };

describe('classifyScore', () => {
  it('maps to correct tier', () => {
    expect(classifyScore(0).tier).toBe('cold');
    expect(classifyScore(39).tier).toBe('cold');
    expect(classifyScore(40).tier).toBe('developing');
    expect(classifyScore(59).tier).toBe('developing');
    expect(classifyScore(60).tier).toBe('sql_weak');
    expect(classifyScore(74).tier).toBe('sql_weak');
    expect(classifyScore(75).tier).toBe('sql_valid');
    expect(classifyScore(89).tier).toBe('sql_valid');
    expect(classifyScore(90).tier).toBe('sql_priority');
    expect(classifyScore(100).tier).toBe('sql_priority');
  });
});

describe('computeQualificationScore', () => {
  it('returns 0 when nothing is filled', () => {
    const r = computeQualificationScore({}, { hasAccount: false, hasContact: false });
    expect(r.total).toBe(0);
    expect(r.classification.tier).toBe('cold');
    expect(r.canMoveToSales).toBe(false);
    expect(r.blockers.length).toBeGreaterThan(0);
  });

  it('awards full 100 with a perfect priority lead', () => {
    const r = computeQualificationScore(
      {
        nome_evento: 'Feira X',
        data_evento: '2026-12-01',
        local_evento: 'SP',
        conexoes_simultaneas: 500,
        equipamentos: ['notebook'],
        finalidade_uso: ['vendas_stand'],
        urgencia_real: 'ate_3_dias',
        poder_decisao: 'decisor_final',
        proximo_passo: 'enviar_proposta',
        permissao_proposta: 'cliente_pediu_proposta',
      },
      fullCtx
    );
    expect(r.total).toBe(100);
    expect(r.classification.tier).toBe('sql_priority');
    expect(r.canMoveToSales).toBe(true);
    expect(r.blockers).toEqual([]);
  });

  it('uses partial points for evento group', () => {
    const r = computeQualificationScore(
      { nome_evento: 'X', data_evento: '2026-12-01' },
      fullCtx
    );
    const evento = r.breakdown.find((b) => b.key === 'evento')!;
    expect(evento.got).toBe(7 + 7);
  });

  it('blocks handoff if permissao is invalid even with high score', () => {
    const r = computeQualificationScore(
      {
        nome_evento: 'X',
        data_evento: '2026-12-01',
        local_evento: 'SP',
        conexoes_simultaneas: 100,
        equipamentos: ['notebook'],
        finalidade_uso: ['vendas_stand'],
        urgencia_real: 'ate_3_dias',
        poder_decisao: 'decisor_final',
        proximo_passo: 'enviar_proposta',
        permissao_proposta: 'sdr_sugerindo',
      },
      fullCtx
    );
    expect(r.total).toBeGreaterThanOrEqual(75);
    expect(r.canMoveToSales).toBe(false);
    expect(r.blockers).toContain('Permissão real para proposta válida');
  });

  it('urgencia tier acima_30_dias awards 6', () => {
    const r = computeQualificationScore({ urgencia_real: 'acima_30_dias' }, fullCtx);
    expect(r.breakdown.find((b) => b.key === 'urgencia')!.got).toBe(6);
  });
});
