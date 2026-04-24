## Diagnóstico atual do Kairós

O problema desta execução não foi “falta de expositores” no site. O site da Bett tem conteúdo suficiente e, inclusive, a página expõe a lista de empresas em markdown/HTML.

### O que eu confirmei
- A execução mais recente foi concluída com:
  - `pages_discovered: 1`
  - `list_pages_scraped: 0`
  - `exhibitors_extracted_raw: 0`
  - `persisted_prospects: 0`
- O `scoreThreshold` estava em `0`, então o problema não foi filtro de score.
- O `input_payload.event_url` salvo na execução veio assim:
  - `https://brasil.bettshow.com/lista-de-expositores e validar que leads/expositores`
- Ou seja: a URL foi enviada com texto extra junto. Isso quebra o scraping logo na origem.
- Além disso, ao buscar a URL correta, a própria página já contém a lista de expositores em conteúdo extraível, com blocos como:
  - `## 3B SCIENTIFIC`
  - `Stand: P160`
  - `## 4HEROES`
  - etc.

### Conclusão objetiva
Hoje o módulo **não está operacional de forma definitiva** para esse fluxo de evento, porque ele ainda depende demais de heurísticas e não protege o usuário contra input inválido.

O principal problema desta rodada foi:
1. **URL malformada no input**
2. **Falta de validação/sanitização da URL antes da execução**
3. **Ausência de fallback determinístico específico para páginas de expositores já renderizadas em markdown/HTML**

## O que precisa ser ajustado

### 1) Blindar a entrada da URL do evento
- Validar que o campo seja uma URL real.
- Sanitizar o valor antes de enviar para a função.
- Rejeitar entradas com espaço + texto adicional após a URL.
- Mostrar erro claro no formulário, em vez de rodar uma execução inválida.

### 2) Criar pré-validação antes da execução
Antes de iniciar a busca:
- testar a URL;
- confirmar status HTTP/extração mínima;
- mostrar um diagnóstico rápido como:
  - URL válida
  - conteúdo encontrado
  - página parece conter expositores
  - página parece SPA / A-Z

Se a pré-validação falhar, a execução não deve começar.

### 3) Adicionar parser determinístico para páginas de expositores
Para esse tipo de página, não depender só de IA.

Implementar um parser direto para padrões como:
- `## NOME DA EMPRESA`
- `Stand: XYZ`
- imagens/logo antes do nome
- grupos em sequência repetida

Esse parser deve rodar:
- antes da IA quando o markdown já estiver “rico”, ou
- como fallback forte quando a IA retornar pouco/zero.

### 4) Melhorar a estratégia do handler de evento
No `lead-sourcing`:
- logar tamanho do markdown/html retornado por página;
- distinguir claramente:
  - URL inválida
  - scrape vazio
  - scrape com conteúdo mas parser zerado
  - parser extraiu, mas persistência falhou
- se o markdown da página principal já contiver dezenas de blocos de empresa, pular a etapa cara de SPA/A-Z e extrair direto dali.

### 5) Melhorar a transparência na UI
No detalhe da execução, exibir:
- URL efetivamente usada
- chars de markdown/html capturados
- tipo de extração aplicada:
  - mapa
  - SPA/A-Z
  - parser markdown
  - parser HTML híbrido
- motivo explícito de “0 leads”

Exemplo de mensagem correta:
- “Execução abortada: URL inválida”
- “Conteúdo capturado, mas nenhum padrão de expositor identificado”
- “Expositores identificados, mas persistência falhou”

## Implementação proposta

### Arquivos impactados
- `src/components/playbook/LeadSearchForm.tsx`
- `supabase/functions/lead-sourcing/index.ts`
- `src/components/playbook/RunDetailDrawer.tsx`
- possivelmente `src/components/playbook/LeadSourcingEngine.tsx` para feedback de pré-check

### Mudanças
1. **Frontend**
- validação forte do campo `URL do Evento`
- sanitização do input
- bloqueio do submit se a URL estiver inválida
- mensagem de ajuda específica para páginas de expositores

2. **Backend function**
- normalização segura da URL
- early fail com mensagem amigável se houver texto extra
- novo parser determinístico de expositores por markdown/HTML
- logs diagnósticos melhores
- regra: se encontrar blocos `## empresa + Stand`, persistir direto

3. **Observabilidade**
- detalhar no drawer como a extração aconteceu
- expor contadores úteis para troubleshooting real

## Resultado esperado após a correção
- O Kairós deixa de executar com URL inválida.
- Páginas como a da Bett passam a gerar expositores mesmo sem depender só da IA.
- “0 leads” passa a significar um caso real, e não falha silenciosa do pipeline.
- O módulo fica muito mais confiável para operação do time de pré-vendas em eventos.

## Detalhes técnicos

Fluxo alvo:

```text
Form URL
  -> sanitize + validate
  -> preflight check
  -> run lead-sourcing
      -> fetch/map page
      -> detect rich exhibitor markdown
      -> deterministic parser
      -> AI enrichment only if needed
      -> dedupe + persist
      -> clear run diagnostics
```

Parser alvo para esse tipo de página:

```text
[logo/imagem]
## NOME DA EMPRESA
Stand: X123
```

Esse padrão já aparece na página da Bett e é suficiente para capturar empresas com alta confiabilidade.

## Observação importante
Há uma evidência forte de que a última execução usou uma URL contaminada com texto extra. Mesmo assim, o sistema deveria ter impedido essa execução. Esse é exatamente o tipo de proteção que vou adicionar na implementação.