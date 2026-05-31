import { describe, it, expect } from 'vitest';
import { scoreDiagnosisQuality } from './diagnosisQuality';

describe('scoreDiagnosisQuality', () => {
  it('returns 0/missing when no text provided', () => {
    const r = scoreDiagnosisQuality({});
    expect(r.score).toBe(0);
    expect(r.bucket).toBe('missing');
  });

  it('scores a strong diagnosis high', () => {
    const r = scoreDiagnosisQuality({
      sellerDiagnosis:
        'Perdemos porque o cliente já tinha fechado com outro fornecedor antes da proposta chegar, devido a um prazo de implantação muito apertado. Precisamos revisar o tempo de resposta comercial.',
      sellerSelectedCategory: 'competition',
      aiDetectedCategory: 'competition',
      recommendedAction: 'Revisar velocidade de abordagem e criar alerta de oportunidade parada.',
    });
    expect(r.score).toBeGreaterThanOrEqual(80);
    expect(r.bucket).toBe('strong');
  });

  it('classifies a short text as weak', () => {
    const r = scoreDiagnosisQuality({ sellerDiagnosis: 'caro' });
    expect(r.bucket).toBe('weak');
  });

  it('penalizes contradiction between seller and AI', () => {
    const aligned = scoreDiagnosisQuality({
      sellerDiagnosis: 'Cliente acha o preço alto demais para o orçamento atual deles.',
      sellerSelectedCategory: 'price',
      aiDetectedCategory: 'price',
    });
    const contradiction = scoreDiagnosisQuality({
      sellerDiagnosis: 'Cliente acha o preço alto demais para o orçamento atual deles.',
      sellerSelectedCategory: 'price',
      aiDetectedCategory: 'timing',
    });
    expect(aligned.score).toBeGreaterThan(contradiction.score);
  });
});
