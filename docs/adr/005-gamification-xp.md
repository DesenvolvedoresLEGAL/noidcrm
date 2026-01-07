# ADR-005: Sistema de Gamificação e XP

## Status

Aceito

## Data

2024-03-01

## Contexto

Para aumentar engajamento e motivação de vendedores, o sistema precisa de mecânicas de gamificação:
- Sistema de pontos (XP)
- Conquistas/Badges
- Rankings/Leaderboards
- Desafios e Metas

### Forças em Jogo
- **Motivação**: Vendedores respondem bem a competição saudável
- **Métricas**: Gamificação deve reforçar comportamentos desejados
- **Fairness**: Sistema deve ser justo para diferentes perfis
- **Complexidade**: Não pode ser difícil de entender
- **Performance**: Cálculos de XP não podem impactar operações principais

## Decisão

> Nós decidimos implementar um **sistema de XP baseado em atividades** com **badges por conquistas** e **rankings por período**, processado de forma **assíncrona**.

### Componentes

1. **XP por Atividade**: Cada ação tem pontos definidos
2. **Badges**: Conquistas especiais por marcos
3. **Levels**: Progressão baseada em XP total
4. **Rankings**: Competição por período (diário, semanal, mensal)

## Alternativas Consideradas

### Alternativa 1: Apenas Badges
- **Prós**: Simples, visual
- **Contras**: Sem progressão contínua, menos engajante

### Alternativa 2: Sistema de Moedas/Pontos Trocáveis
- **Prós**: Incentivo tangível
- **Contras**: Complexidade, risco de gaming the system

### Alternativa 3: Sem Gamificação
- **Prós**: Sem complexidade adicional
- **Contras**: Menor engajamento, diferencial competitivo perdido

## Consequências

### Positivas
- **Engajamento**: Usuários retornam para ver progresso
- **Comportamento**: Reforça ações desejadas (atividades, follow-ups)
- **Visibilidade**: Gestores veem quem está performando
- **Diversão**: Torna o trabalho mais leve

### Negativas
- **Gaming**: Usuários podem tentar manipular métricas
- **Desmotivação**: Ranking pode desmotivar quem está em baixo
- **Manutenção**: Balanceamento de XP requer ajustes

### Riscos
- **Foco errado**: XP em métricas erradas. Mitigado por configuração por org.
- **Toxicidade**: Competição excessiva. Mitigado por badges colaborativos.

## Implementação

### Estrutura de XP

```typescript
// Pontos por tipo de atividade
const XP_VALUES = {
  // Atividades básicas
  call_made: 10,
  email_sent: 5,
  meeting_scheduled: 20,
  meeting_completed: 30,
  
  // Progresso de deals
  opportunity_created: 15,
  opportunity_stage_advanced: 25,
  opportunity_won: 100,
  
  // Qualidade
  activity_with_notes: 5, // bonus
  fast_followup: 10, // < 24h
} as const;
```

### Tabelas

```sql
-- XP acumulado por vendedor
CREATE TABLE seller_xp (
    id UUID PRIMARY KEY,
    seller_id UUID NOT NULL REFERENCES sellers(id),
    organization_id UUID NOT NULL,
    total_xp INT DEFAULT 0,
    current_level INT DEFAULT 1,
    xp_this_week INT DEFAULT 0,
    xp_this_month INT DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Histórico de XP ganho
CREATE TABLE xp_transactions (
    id UUID PRIMARY KEY,
    seller_id UUID NOT NULL,
    organization_id UUID NOT NULL,
    xp_amount INT NOT NULL,
    source_type TEXT NOT NULL, -- 'activity', 'badge', 'bonus'
    source_id UUID,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Badges conquistados
CREATE TABLE seller_badges (
    id UUID PRIMARY KEY,
    seller_id UUID NOT NULL REFERENCES sellers(id),
    badge_id UUID NOT NULL REFERENCES badges(id),
    earned_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(seller_id, badge_id)
);
```

### Processamento Assíncrono

```typescript
// Trigger após atividade
CREATE OR REPLACE FUNCTION process_activity_xp()
RETURNS TRIGGER AS $$
BEGIN
  -- Insere na fila para processamento
  INSERT INTO xp_processing_queue (
    seller_id,
    activity_id,
    activity_type,
    created_at
  ) VALUES (
    NEW.owner_user_id,
    NEW.id,
    NEW.type,
    now()
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### Fórmula de Level

```typescript
// XP necessário para cada level (exponencial)
function xpForLevel(level: number): number {
  return Math.floor(100 * Math.pow(1.5, level - 1));
}

// Level 1: 100 XP
// Level 2: 150 XP
// Level 3: 225 XP
// Level 5: 506 XP
// Level 10: 3,844 XP
```

## Tipos de Badges

| Categoria | Exemplos |
|-----------|----------|
| Atividade | "Cold Caller" (100 ligações), "Email Master" (500 emails) |
| Conversão | "Closer" (10 deals ganhos), "Big Fish" (deal > R$100k) |
| Consistência | "Streak" (5 dias seguidos), "Early Bird" (atividade antes das 8h) |
| Colaboração | "Team Player" (ajudou colega), "Mentor" (treinou novato) |
| Especial | "First Blood" (primeiro deal), "Comeback" (reativou lead frio) |

## Referências

- Tabelas: `seller_xp`, `xp_transactions`, `badges`, `seller_badges`
- Componentes: `src/components/gamification/`
- [Octalysis Framework](https://yukaichou.com/gamification-examples/octalysis-complete-gamification-framework/)
