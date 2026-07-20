# NOID Security — Single-Project Change Protocol v1

**Sprint:** NOID-SECURITY 1.2
**Escopo:** protocolo obrigatório para toda mudança **AMARELA** no projeto
único Lovable Cloud (ref `urihdqturaebhiefwjnw`). Mudanças **VERMELHAS**
são proibidas. Mudanças **VERDES** podem ser executadas sem este protocolo,
mas devem ser registradas no relatório final da sprint.

Referência conceitual: `single-project-security-model-v1.md`, seção 5.

## 1. Regra absoluta

- Uma mudança AMARELA por vez.
- Sem paralelismo na mesma superfície.
- Rollback escrito **antes** da aplicação.
- Smoke test **imediato** após a aplicação.
- Reversão **imediata** em qualquer regressão detectada na operação real.

## 2. Template ANTES

Preencher antes de aplicar qualquer mudança AMARELA:

```
ID: NSEC-1.2-CHG-<nnn>
Data/hora (UTC):
Autor:
Superfície: <RLS | RPC | Edge Function | Storage | Auth | Migration>
Módulos afetados:
Tabelas afetadas:
RPCs afetadas:
Edge Functions afetadas:
Usuários potencialmente afetados: <contagem mascarada>
Problema (achado de segurança):
Evidência (query, log, teste sintético):
Classificação de risco: AMARELO
Mudança proposta (descrição funcional):
Migration idempotente? [ ] sim  [ ] n/a
Rollback (SQL ou passos):
Snapshot/backup possível? [ ] sim  [ ] não  Descrever:
Critério de sucesso:
Critério de interrupção:
Janela de menor impacto:
Aprovação humana obrigatória: [ ] sim  [ ] não
```

## 3. Template EXECUÇÃO

```
Início (UTC):
Aplicação idempotente confirmada: [ ]
Sem dados reais criados: [ ]
Sem secret em log: [ ]
Sem alteração paralela na mesma superfície: [ ]
```

## 4. Template DEPOIS

```
Smoke test sintético (fixtures SECURITY_TEST_*): [ ] verde [ ] vermelho
Smoke test operação real não destrutivo (login, dashboard, oportunidades,
  propostas, forecast, revenue command): [ ] verde [ ] vermelho
Logs revisados (Auth, Edge, banco, frontend): [ ] verde [ ] vermelho
Regressão detectada: [ ] sim → ROLLBACK  [ ] não
Decisão: [ ] MANTER  [ ] ROLLBACK
Observação (>= 15 min) concluída: [ ]
Registro final no relatório correspondente: [ ]
```

## 5. Regras de rollback

- Rollback deve reverter policy/RPC/EF ao estado exato anterior.
- Rollback nunca apaga dados reais.
- Rollback preserva dados sintéticos para regressão futura, salvo decisão
  explícita no runbook de cleanup.
- Rollback é executado pelo mesmo protocolo (ID `NSEC-1.2-RBK-<nnn>`).

## 6. Regras de observação

- Após cada mudança AMARELA, janela mínima de 15 minutos monitorando:
  - Erros de Auth.
  - Erros de Edge Functions.
  - Erros de banco.
  - Erros de frontend.
  - Falhas de propostas.
  - Falhas de Storage.
  - Latência anômala.
- Nenhuma segunda mudança AMARELA é iniciada dentro dessa janela.

## 7. Proibições

- Não executar mudança VERMELHA (ver seção 5 do modelo v1).
- Não alterar múltiplas policies em lote.
- Não privatizar buckets existentes em massa.
- Não migrar arquivos históricos massivamente nesta sprint.
- Não apagar dados reais.
- Não expor service role no frontend.
- Não logar tokens, senhas, chaves privadas ou payloads sensíveis.
- Não executar publish automático.
- Não reescrever histórico Git.

## 8. Registro obrigatório

Toda mudança AMARELA aplicada deve aparecer em:

1. Este protocolo (bloco ANTES/EXECUÇÃO/DEPOIS anexado ao relatório da
   sprint ou vinculado por ID).
2. `docs/security/security-findings-v1.csv` (achado + mitigação).
3. Relatório da fase correspondente
   (`single-project-tenant-test-report-v1.md`, storage, convites, etc.).
4. `single-project-security-gate-v1.md` na conclusão.

## 9. Log de mudanças desta sprint

Nenhuma mudança AMARELA aplicada até o momento — sprint pausada para
aprovação humana da janela operacional e das fixtures sintéticas antes
da Fase 3.

| ID | Data/hora | Superfície | Descrição | Status |
| --- | --- | --- | --- | --- |
| — | — | — | — | — |
