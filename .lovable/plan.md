

## Alerta visual de estagnação nos cards do pipeline

### Situação atual
O card já recebe `days_in_stage` e `stagnation_alert_days` da etapa, e já tem um pequeno chip colorido mostrando os dias. Porém, o **card em si não muda de aparência** quando está estagnado — o alerta é discreto demais.

### O que será feito

**Arquivo: `src/components/OpportunityCard.tsx`**

Quando `daysInStage > stagnationDays` (dias na etapa excede o alerta configurado), o card receberá:

1. **Fundo avermelhado sutil** — um `bg-red-50/60` (light) / `bg-red-950/30` (dark) no Card
2. **Borda esquerda vermelha** — sobrepõe a borda de temperatura com vermelho quando estagnado
3. **Anel vermelho pulsante** — `ring-1 ring-red-400/50` para chamar atenção
4. **Ícone de alerta** — um pequeno indicador `AlertTriangle` no canto superior direito do card

Isso mantém a hierarquia visual: cards normais ficam limpos, cards estagnados ficam visivelmente "pintadinhos de vermelho" como solicitado.

### Lógica
```
Se days_in_stage > stagnation_alert_days → visual vermelho
Se days_in_stage > stagnation_alert_days * 1.5 → visual vermelho mais intenso (crítico)
```

### Resultado esperado
Cards que ultrapassam o tempo de alerta da etapa ficarão visualmente destacados em vermelho no Kanban, facilitando a identificação imediata de oportunidades estagnadas.

