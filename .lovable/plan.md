Plano para resolver FISPAL TECNOLOGIA:

1. Atualizar o provider `informa-markets.ts`
   - Hoje ele só detecta URLs no formato `/event/.../exhibitors/...`.
   - A Fispal Tecnologia usa iframe no formato `/widget/event/.../exhibitors/<viewId>` dentro da página oficial.
   - Vou adicionar suporte a esse formato de widget e ao iframe embutido na página de marketing.

2. Corrigir paginação oficial da Informa/Swapcard
   - Usar a API GraphQL pública da própria Informa com `eventId` + `viewId` do iframe.
   - Confirmado no teste: a API retorna `totalCount = 487` para esse viewId, com 100 itens por página.
   - Isso substitui o scrape genérico que pegou só 5 itens/lixo.

3. Preservar tudo que já funcionou
   - Não vou remover nem reordenar os providers já criados: ExpoFP, Informa atual, NürnbergMesse, DRTS/Exposec, Francal/TOTVS/Naturaltech, InfraFM e MundoGEO/Drone Show.
   - A mudança é aditiva no provider Informa, que já é o tipo correto para Fispal Food e agora cobre Fispal Tecnologia também.

4. Validar antes de finalizar
   - Testar localmente a extração contra `https://www.fispaltecnologia.com.br/quero-expor/lista-expositores/`.
   - Validar que retorna centenas de expositores reais, com nome, estande e profile URL.
   - Depois deployar a função `lead-sourcing`.

Causa raiz: não é Francal/TOTVS; é Informa/Swapcard via iframe `widget`. O provider antigo não reconhecia esse URL de widget, por isso caiu no fluxo genérico e extraiu só 5 registros ruins.