# MITIGA — Design System v0.1

Status: candidato para aprovação visual. Esta versão define a direção de marca e os padrões iniciais das telas de login, empresa, super admin e operador.

## Conceito

**Confiança silenciosa:** uma interface de risco deve transmitir controle, precisão e serenidade. A linguagem visual evita contrastes agressivos, excesso de alertas e clichês de segurança. O principal gesto de marca é o **campo de risco**, um gradiente discreto que conecta hero, cabeçalho e sidebar e muda de intensidade conforme o contexto.

## Princípios

1. **Prioridade legível:** o risco mais importante aparece primeiro; cor nunca é o único sinal.
2. **Densidade controlada:** muita informação, mas com agrupamentos claros, respiro e filtros previsíveis.
3. **Decisão auditável:** score, status e recomendações sempre mostram origem, data e responsável.
4. **Premium sem ornamento:** poucos efeitos, sombras suaves, gradientes funcionais e microinterações curtas.
5. **Papéis distintos, mesma gramática:** empresa, super admin e operador compartilham componentes, porém mudam foco, permissões e hierarquia.

## Assinatura visual

- Símbolo: duas rotas interligadas formando um “M” abstrato e um espaço protegido no centro.
- Wordmark: `MITIGA` em Avenir Next Demi Bold, caixa alta, tracking de 0.12em.
- Cor principal: ink/petrol; apoio: mineral e violeta dessaturado.
- Evitar: escudo, cadeado, check genérico, neon, preto puro e vermelho saturado.
- O arquivo PNG atual é um conceito v0.1; a vetorização final deve ocorrer após a aprovação.

## Tipografia e hierarquia

- Interface: Avenir Next; fallback para Avenir, Helvetica Neue, Arial e sans-serif.
- Dados técnicos: SF Mono ou equivalente monoespaçada.
- Display: 48/52; H1: 32/38; H2: 22/29; corpo: 15/23; label: 12/16.
- Pesos preferidos: Regular 400, Medium 500 e Demi Bold 600.

## Estrutura de aplicação

- Desktop: sidebar de 264 px; topbar de 72 px; conteúdo em grade de 12 colunas, máximo de 1440 px.
- Tablet: sidebar compacta de 88 px e painel secundário em drawer.
- Mobile: navegação inferior para rotas primárias; filtros e detalhes em sheets.
- Área hero: resumo da decisão, score e contexto; o gradiente se prolonga até a sidebar.

## Componentes prioritários

- Navegação: app shell, sidebar, breadcrumbs, switcher de empresa e command palette.
- Entrada: input, select, combobox, date range, busca, upload e autenticação em duas etapas.
- Informação: card, score ring/bar, badge, tooltip, timeline, tabela densa e painel de evidências.
- Ação: button primário/secundário/ghost/danger, split button e menu contextual.
- Feedback: toast, alerta inline, modal de confirmação, skeleton, empty state, erro recuperável e bloqueio de permissão.

Cada componente deve ter estados default, hover, focus-visible, active, disabled, loading e error. Animações: 150 ms para cor e 200 ms para elevação/deslocamento, respeitando `prefers-reduced-motion`.

## Papel por tela

| Visão | Decisão central | Conteúdo prioritário | Ações-chave |
|---|---|---|---|
| Login | Entrar com segurança | credenciais, SSO, 2FA, ambiente | acessar, recuperar senha |
| Empresa | Entender exposição e decidir | risco consolidado, clientes, alertas, recomendações | criar avaliação, revisar alertas, exportar |
| Super admin | Governar a plataforma | tenants, saúde técnica, consumo, regras e auditoria | suspender tenant, ajustar plano, investigar evento |
| Operador | Processar a fila | SLA, casos atribuídos, evidências e histórico | assumir, solicitar evidência, concluir ou escalar |

## Regras de acessibilidade

- Contraste mínimo WCAG AA para texto e controles.
- Foco visível com halo de 3 px, sem depender apenas de cor.
- Status combinam rótulo, ícone e cor.
- Alvos de toque mínimos de 44 × 44 px.
- Tabelas preservam cabeçalho e permitem leitura linear em telas menores.

## Critérios para aprovação desta etapa

- Direção do símbolo e do wordmark.
- Paleta e intensidade dos gradientes.
- Tipografia e sensação de densidade.
- Comportamento visual da transição hero–sidebar.
- Hierarquia das quatro telas.
- Estilo de cards, tabelas, status e ações.

Após a aprovação, a próxima versão deve incluir biblioteca de componentes em código, especificação responsiva por breakpoint e protótipo navegável dos fluxos prioritários.

