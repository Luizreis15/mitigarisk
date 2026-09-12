# PRD — SaaS de Gestão, Avaliação e Monitoramento de Riscos

> **Language decision update — 12 September 2026:** ADR 0002 supersedes the Portuguese-first assumption in this discovery document. MITIGA is English-first and market-neutral. This PRD remains historical source material and must be rewritten for the international product; it must not be translated literally.

**Nome do produto:** a definir  
**Versão:** 0.1  
**Status:** descoberta e definição inicial  
**Data:** 11 de setembro de 2026  
**Mercado inicial proposto:** negócios digitais e jogos online no Brasil  
**Responsável pelo documento:** Product Owner, a nomear  
**Responsável técnico:** Tech Lead, a nomear

> Este documento consolida os três arquivos de descoberta recebidos. Exemplos, hipóteses e afirmações regulatórias presentes nas conversas não foram tratados como fatos jurídicos validados. Pontos ainda contraditórios foram transformados em decisões pendentes.

---

## Ementa

1. Resumo executivo
2. Contexto, problema e oportunidade
3. Premissas confirmadas e hipóteses
4. Objetivos, resultados e não objetivos
5. Objeções esperadas e respostas de produto
6. Escopo por fase
7. Personas, papéis e visões do sistema
8. Jornadas e fluxos operacionais
9. Requisitos funcionais
10. Motor de risco e motor de política
11. Arquitetura de solução
12. Frontend
13. Backend
14. API e integrações
15. Dados e banco de dados
16. Processamento e consultas em tempo real
17. Segurança, privacidade e criptografia
18. Auditoria, explicabilidade e governança regulatória
19. Requisitos não funcionais e níveis de serviço
20. Operação, suporte e resposta a incidentes
21. Modelo de cobrança e receita recorrente
22. Owners, equipe e governança do projeto
23. Plano de execução e cronograma
24. Estratégia de qualidade e testes
25. Riscos operacionais e técnicos
26. Métricas de produto, operação e negócio
27. Critérios de aceite do MVP
28. Decisões pendentes
29. Próximos passos

---

## 1. Resumo executivo

O produto será um SaaS B2B multiempresa para avaliação, classificação, monitoramento e documentação de riscos. Ele será integrado ao ambiente operacional das empresas contratantes e receberá, por API, dados cadastrais, documentais e, em fases posteriores, transacionais.

Cada empresa configurará seus próprios fatores, pesos, limites, países aceitos, políticas e apetite de risco. A plataforma combinará essas informações, produzirá scores por dimensão, uma classificação consolidada, motivos, pendências e recomendações. A decisão de aprovar, limitar, solicitar documentos ou rejeitar continuará pertencendo à empresa contratante.

O produto terá dois grandes momentos:

1. **Onboarding e perfil inicial de risco:** classificação do cliente antes ou durante sua entrada na operação.
2. **Monitoramento contínuo:** comparação das transações e do comportamento posterior com o perfil inicialmente declarado.

O MVP deve priorizar onboarding, parametrização, API, explicabilidade e auditoria. O monitoramento transacional será projetado desde o início, mas ativado depois da validação do primeiro fluxo.

### Decisão de arquitetura recomendada

Começar com um **monólito modular**, API-first, com processamento assíncrono para tarefas demoradas. Isso reduz custo e complexidade no MVP sem impedir a futura separação do motor de regras, conectores, monitoramento transacional e notificações em serviços independentes.

### Quantas visões teremos?

O produto terá **sete visões operacionais**, definidas por papel e permissão:

1. Administração do SaaS.
2. Gestão executiva da empresa contratante.
3. Administração da empresa contratante.
4. Analista de risco e compliance.
5. Operação e atendimento.
6. Auditoria e leitura.
7. Desenvolvimento e integrações.

Dados, API, backend, retorno e tempo real são capacidades da plataforma que atendem essas visões; não são visões de usuário isoladas. O cliente final da empresa contratante não terá portal próprio no MVP.

---

## 2. Contexto, problema e oportunidade

### 2.1 Problema

Empresas expostas a risco regulatório, financeiro, operacional e reputacional frequentemente executam avaliações em planilhas, documentos dispersos ou ferramentas pouco configuráveis. Isso provoca:

- análises lentas e inconsistentes;
- dificuldade para provar qual regra foi aplicada;
- pouca rastreabilidade das mudanças de política;
- decisões dependentes de conhecimento individual;
- baixa integração com cadastro e transações;
- dificuldade para comparar comportamento real com perfil declarado;
- maior custo de auditoria e investigação;
- risco de abandono no onboarding de operações digitais de alta velocidade.

### 2.2 Oportunidade

Criar uma camada de infraestrutura de risco que possa ser embutida em bancos, jogos online, marketplaces e outras operações digitais. A diferenciação estará na combinação de:

- parametrização por empresa;
- velocidade de resposta;
- múltiplas dimensões de risco;
- explicabilidade e trilha de auditoria;
- integração por API;
- isolamento entre contratantes;
- monitoramento contínuo;
- módulos de inteligência assistiva sem delegar a decisão final a um modelo opaco.

### 2.3 Proposta de valor

**Para empresas digitais e reguladas que precisam avaliar clientes e operações com rapidez, o produto oferece um motor de risco configurável, integrado e auditável, que transforma dados cadastrais e transacionais em classificações explicáveis, respeitando o apetite de risco de cada contratante.**

---

## 3. Premissas confirmadas e hipóteses

### 3.1 Premissas confirmadas pelas conversas

- O produto é B2B e será contratado por empresas.
- Cada empresa terá políticas e apetite de risco próprios.
- O produto será multi-tenant, sem compartilhamento automático de perfis entre empresas.
- O cadastro e os documentos são coletados pela empresa contratante.
- A plataforma recebe informações por integração e calcula risco.
- A ferramenta classifica e explica; a decisão final pertence à contratante.
- O sistema deverá registrar pendências e qualidade insuficiente dos dados.
- A avaliação precisa gerar evidências auditáveis.
- O produto terá perfil inicial e monitoramento transacional.
- Em jogos online, velocidade de onboarding é crítica.
- “Agentes” são, neste momento, módulos ou capacidades; IA autônoma não é requisito central do MVP.

### 3.2 Hipóteses de trabalho

- O primeiro nicho será o de jogos online no Brasil.
- A primeira versão será hospedada em nuvem e vendida como SaaS.
- O MVP utilizará regras determinísticas e pesos configuráveis.
- Integrações externas serão opcionais e assíncronas.
- A plataforma armazenará o mínimo necessário para auditoria; zero retenção integral é incompatível com a exigência de evidência completa.
- O cliente final interagirá com a interface da empresa contratante, não diretamente com o SaaS.
- O inglês será necessário para expansão internacional, mas português será o idioma inicial.

### 3.3 Decisões ainda não confirmadas

- Mercado e país exatos do piloto.
- Fontes externas obrigatórias.
- Prazo oficial para resposta completa.
- Política de retenção e residência dos dados.
- Se o score ou apenas a política de aceitação varia por contratante.
- Se haverá recomendação operacional além da classificação.
- Escopo do reporte regulatório.
- Modelo comercial e preço.

---

## 4. Objetivos, resultados e não objetivos

### 4.1 Objetivos do produto

1. Calcular riscos de forma consistente e configurável.
2. Reduzir o tempo entre cadastro e retorno à empresa.
3. Tornar cada resultado explicável por fatores e regras.
4. Gerar evidências para auditoria e revisão interna.
5. Separar rigorosamente dados, políticas e usuários de cada empresa.
6. Integrar o motor ao fluxo operacional por API e webhooks.
7. Permitir evolução do perfil com base em novas informações e comportamento.
8. Viabilizar expansão por setor, país e dimensão de risco.

### 4.2 Resultados mensuráveis propostos para o piloto

- 100% das avaliações vinculadas a uma versão imutável de política.
- 100% dos resultados com códigos de motivo ou indicação explícita de insuficiência de dados.
- Zero acesso cruzado entre empresas em testes de isolamento.
- Resposta do motor interno, sem terceiros, em até 2 segundos no percentil 95.
- Confirmação de recebimento de evento transacional em até 500 ms no percentil 95.
- Disponibilidade mensal inicial de 99,9%, após a fase piloto.
- Entrega de webhook com sucesso em 99,5% dos eventos, considerando retentativas.
- Redução de pelo menos 50% no tempo operacional de análise do fluxo piloto.

### 4.3 Não objetivos do MVP

- Criar um bureau global ou perfil compartilhado entre empresas.
- Substituir a decisão da empresa contratante.
- Garantir ausência de fraude, lavagem de dinheiro ou perda financeira.
- Atuar como autoridade regulatória ou emitir parecer jurídico.
- Coletar todos os dados diretamente do cliente final.
- Oferecer crédito ou definir limites financeiros por conta própria.
- Automatizar reporte externo ao regulador sem validação jurídica e humana.
- Utilizar IA opaca como única base de uma classificação adversa.
- Atender simultaneamente todos os setores e países no primeiro lançamento.

---

## 5. Objeções esperadas e respostas de produto

| Objeção | Resposta de produto |
|---|---|
| “Já fazemos isso em planilhas.” | O produto agrega versionamento, consistência, integração, velocidade, acesso controlado e trilha de auditoria. |
| “Um score único não serve para todas as empresas.” | Políticas, pesos, limites e procedimentos serão configurados por tenant. |
| “Não queremos entregar os dados ao fornecedor.” | O produto aplicará minimização, criptografia, retenção configurável e opções de implantação dedicadas para clientes enterprise. |
| “Se a IA errar, quem responde?” | O núcleo será determinístico e explicável; IA será assistiva. A contratante mantém a decisão final. |
| “Integrações externas podem atrasar o onboarding.” | O fluxo terá resposta preliminar, processamento assíncrono, prazos por conector e resultado final por webhook. |
| “Haverá muitos falsos positivos.” | Políticas terão simulação, versionamento, calibração, revisão humana e métricas de eficácia. |
| “Integrar mais um fornecedor é complexo.” | Haverá sandbox, documentação, exemplos, webhooks assinados e contratos de API versionados. |
| “Um vazamento entre empresas seria inaceitável.” | Isolamento será aplicado em autenticação, aplicação, banco, criptografia, testes e observabilidade. |
| “O produto parece genérico demais.” | A plataforma terá núcleo comum e pacotes de políticas por vertical, começando pelo nicho escolhido. |
| “Não podemos depender da plataforma para autorizar todas as transações.” | A empresa definirá seu procedimento de contingência; o MVP não será o decisor final no caminho crítico. |

---

## 6. Escopo por fase

### 6.1 Fase 0 — Descoberta e desenho

- Definição do nicho e país do piloto.
- Mapeamento regulatório por especialista.
- Dicionário de dados do onboarding.
- Taxonomia de riscos e códigos de motivo.
- Contrato inicial da API.
- Protótipo das principais telas.
- Política de privacidade, retenção e responsabilidades.
- Identificação dos quatro concorrentes de referência.

### 6.2 Fase 1 — MVP de onboarding

- Multi-tenancy.
- Gestão de usuários, papéis e permissões.
- Autenticação segura e MFA administrativo.
- Portal da empresa.
- Configuração e versionamento de políticas.
- API de avaliações.
- Validação de completude e qualidade.
- Motor determinístico de regras e score.
- Scores por dimensão e score consolidado.
- Classificação, motivos, pendências e recomendação.
- Histórico, evidências e auditoria.
- Consulta e exportação de avaliações.
- Webhooks de conclusão.
- Sandbox e empresa fictícia para integração.
- Medição de uso para cobrança.

### 6.3 Fase 2 — Monitoramento transacional

- Ingestão de eventos em fluxo contínuo.
- Comparação entre perfil declarado e comportamento observado.
- Regras de velocidade, volume, frequência, geografia e padrão.
- Alertas e priorização.
- Gestão de casos e investigação.
- Dashboards em tempo quase real.
- Webhooks para alertas.
- Retentativas, idempotência e fila de mensagens não processadas.

### 6.4 Fase 3 — Conectores e inteligência assistiva

- Provedores de identidade, documentos, crédito, PEP e sanções.
- Extração assistida de documentos.
- Resumos de casos e recomendações para analistas.
- Detecção estatística de anomalias.
- Calibração baseada em resultados conhecidos.
- Pacotes de políticas por vertical e país.

### 6.5 Fase 4 — Escala e enterprise

- Ambientes dedicados.
- Chaves de criptografia por cliente.
- SSO corporativo e provisionamento automático de usuários.
- Residência regional de dados.
- Data warehouse e análises avançadas.
- SLA personalizado.
- Ecossistema de conectores e parceiros.

---

## 7. Personas, papéis e visões do sistema

### 7.1 Visão 1 — Administração do SaaS

**Usuário:** operação interna do fornecedor.  
**Objetivo:** administrar tenants, planos, saúde da plataforma e suporte sem acessar dados sensíveis por padrão.

Funcionalidades:

- criar, suspender e configurar empresas;
- associar planos, limites e recursos;
- acompanhar consumo e disponibilidade;
- gerenciar feature flags;
- consultar metadados operacionais;
- executar suporte com acesso temporário, justificado e auditado;
- acompanhar falhas de integração e webhooks;
- administrar templates globais de política.

### 7.2 Visão 2 — Gestão executiva da empresa

**Usuário:** diretor de risco, compliance ou operações.  
**Objetivo:** entender exposição, tendência, volume e eficácia da política.

Funcionalidades:

- painel executivo;
- distribuição por faixa e dimensão de risco;
- evolução de volume e alertas;
- indicadores de tempo e produtividade;
- comparativo de versões de política;
- relatórios gerenciais;
- consumo e faturamento.

### 7.3 Visão 3 — Administração da empresa

**Usuário:** administrador do tenant.  
**Objetivo:** configurar o ambiente e controlar acessos.

Funcionalidades:

- usuários, equipes, papéis e permissões;
- unidades, marcas, países e ambientes;
- políticas, pesos, limites e procedimentos;
- credenciais de API e webhooks;
- retenção de dados;
- notificações;
- integrações externas;
- aprovação e publicação de novas políticas.

### 7.4 Visão 4 — Analista de risco e compliance

**Usuário:** analista, officer ou investigador.  
**Objetivo:** consultar avaliações, compreender motivos e tratar exceções.

Funcionalidades:

- fila de avaliações e alertas;
- pesquisa de cliente dentro do tenant;
- explicação do score;
- fatores positivos, negativos e pendentes;
- anexos e evidências;
- notas internas;
- solicitação de documentação adicional;
- abertura e tratamento de casos;
- reavaliação com nova informação;
- registro de conclusão humana.

### 7.5 Visão 5 — Operação e atendimento

**Usuário:** equipe de onboarding ou suporte.  
**Objetivo:** acompanhar situação sem alterar política ou visualizar dados desnecessários.

Funcionalidades:

- busca por referência externa;
- status da avaliação;
- pendências liberadas para atendimento;
- prazos estimados;
- resultado operacional permitido pelo papel;
- reenvio de notificação;
- escalonamento para analista.

### 7.6 Visão 6 — Auditoria e leitura

**Usuário:** auditor interno, externo ou responsável de controle.  
**Objetivo:** reconstruir decisões e provar controles.

Funcionalidades:

- acesso somente leitura;
- histórico de política e avaliação;
- trilha de alterações;
- evidências de entrada e saída;
- exportação controlada;
- consulta por período, usuário, regra e resultado;
- relatórios de acesso e segregação de funções.

### 7.7 Visão 7 — Desenvolvimento e integrações

**Usuário:** desenvolvedor da empresa contratante.  
**Objetivo:** integrar, testar e operar a comunicação entre sistemas.

Funcionalidades:

- documentação interativa da API;
- credenciais por ambiente;
- sandbox;
- exemplos de payload;
- logs técnicos sem dados sensíveis;
- histórico e retentativa de webhooks;
- limites e consumo;
- status da plataforma;
- rotação de segredos.

### 7.8 Matriz de acesso resumida

| Capacidade | SaaS Admin | Executivo | Tenant Admin | Analista | Operação | Auditor | Dev/API |
|---|---:|---:|---:|---:|---:|---:|---:|
| Gerenciar tenant | Sim | Não | Parcial | Não | Não | Não | Não |
| Editar política | Não por padrão | Aprovar | Sim | Propor | Não | Não | Não |
| Ver dados sensíveis | Emergencial | Agregado | Conforme papel | Sim | Mínimo | Controlado | Não |
| Tratar caso | Não | Não | Opcional | Sim | Encaminhar | Não | Não |
| Ver auditoria | Metadados | Agregado | Sim | Parcial | Não | Sim | Técnico |
| Gerenciar API | Não por padrão | Não | Sim | Não | Não | Consulta | Sim |
| Ver cobrança | Sim | Sim | Sim | Não | Não | Não | Consumo |

---

## 8. Jornadas e fluxos operacionais

### 8.1 Configuração inicial da empresa

1. Operação do SaaS cria o tenant e associa o plano.
2. Administrador da empresa recebe convite de ativação.
3. Administrador configura MFA, usuários e papéis.
4. Empresa escolhe um template de política ou inicia uma configuração própria.
5. Analista define fatores, pesos, limites e procedimentos.
6. Executivo ou aprovador revisa e publica a política.
7. Desenvolvedor cria credenciais de sandbox.
8. Empresa testa casos conhecidos.
9. Após aceite, são criadas credenciais de produção.

### 8.2 Avaliação de onboarding

1. Cliente final preenche o cadastro na empresa contratante.
2. A empresa valida seu próprio cadastro e envia uma solicitação à API.
3. A API autentica o cliente técnico, identifica o tenant e valida o contrato do payload.
4. O sistema verifica duplicidade por chave de idempotência.
5. Dados são normalizados, minimizados e avaliados quanto à completude.
6. Conectores opcionais são acionados conforme a política.
7. O motor executa regras da versão publicada.
8. O sistema calcula scores por dimensão, incerteza e qualidade dos dados.
9. O agregador produz a faixa consolidada.
10. O sistema retorna ou publica resultado, motivos e pendências.
11. A empresa aplica sua decisão externa.
12. Evidências e trilha de auditoria são registradas.

### 8.3 Resposta rápida e resposta final

Para conciliar velocidade com consultas externas:

- **Resposta imediata:** recebimento, validação básica e identificador da avaliação.
- **Resposta preliminar opcional:** resultado com dados internos disponíveis.
- **Resposta final:** resultado após conectores obrigatórios ou término do prazo configurado.
- **Atualização posterior:** reavaliação se uma fonte atrasada alterar o resultado.

Cada resposta deverá informar `status`, `policy_version`, `is_final`, `data_quality`, `reason_codes` e horário.

### 8.4 Monitoramento transacional

1. A empresa envia o evento com referência de cliente e transação.
2. A API valida, registra idempotência e confirma o recebimento.
3. O evento entra em uma fila durável.
4. O processador recupera o perfil vigente e a política aplicável.
5. Regras avaliam volume, frequência, velocidade, geografia e desvios.
6. Eventos normais atualizam agregados comportamentais.
7. Eventos relevantes geram alertas explicáveis.
8. Alertas podem abrir casos conforme configuração.
9. A empresa recebe webhook e consulta o painel.
10. Analistas investigam e registram a conclusão.

### 8.5 Alteração de política

1. Usuário autorizado cria rascunho baseado em uma versão publicada.
2. Alterações são simuladas em dados anonimizados ou casos de teste.
3. O sistema mostra impacto esperado e diferenças.
4. Aprovador publica a nova versão.
5. Novas avaliações usam a versão nova.
6. Avaliações antigas preservam a versão original.
7. Reprocessamento histórico ocorre apenas por ação explícita e auditada.

---

## 9. Requisitos funcionais

Prioridades: **P0** obrigatório para o MVP, **P1** necessário para o piloto ampliado e **P2** evolução.

### 9.1 Empresas e identidade

| ID | Prioridade | Requisito |
|---|---:|---|
| TEN-001 | P0 | Criar tenant com identificador imutável, plano, região e status. |
| TEN-002 | P0 | Impedir acesso a dados ou configurações de outro tenant. |
| IAM-001 | P0 | Autenticar usuários e exigir MFA para papéis privilegiados. |
| IAM-002 | P0 | Oferecer controle de acesso por papéis e permissões. |
| IAM-003 | P0 | Registrar login, falha, alteração de papel e elevação de acesso. |
| IAM-004 | P1 | Suportar SSO corporativo. |
| IAM-005 | P2 | Suportar provisionamento e desativação automática de usuários. |

### 9.2 Políticas e configuração

| ID | Prioridade | Requisito |
|---|---:|---|
| POL-001 | P0 | Criar fatores, regras, pesos, faixas e pendências. |
| POL-002 | P0 | Manter rascunho separado da versão publicada. |
| POL-003 | P0 | Versionar e tornar imutável cada política publicada. |
| POL-004 | P0 | Exigir aprovação para publicação conforme segregação definida. |
| POL-005 | P0 | Oferecer template inicial por vertical. |
| POL-006 | P1 | Simular impacto de uma política antes da publicação. |
| POL-007 | P1 | Agendar ativação e expiração. |
| POL-008 | P2 | Comparar desempenho entre versões. |

### 9.3 Avaliação e score

| ID | Prioridade | Requisito |
|---|---:|---|
| ASM-001 | P0 | Criar avaliação por API com chave de idempotência. |
| ASM-002 | P0 | Validar contrato, tipos, obrigatoriedade e consistência básica. |
| ASM-003 | P0 | Produzir status de pendência quando faltarem dados necessários. |
| ASM-004 | P0 | Calcular score por dimensão e score consolidado. |
| ASM-005 | P0 | Retornar faixa, motivos, qualidade e versão de política. |
| ASM-006 | P0 | Não emitir aprovação ou reprovação como decisão autônoma. |
| ASM-007 | P0 | Permitir consulta por ID interno e referência externa. |
| ASM-008 | P0 | Manter histórico de reavaliações dentro do tenant. |
| ASM-009 | P1 | Suportar resposta preliminar e final. |
| ASM-010 | P1 | Permitir análise manual e conclusão humana. |

### 9.4 Alertas e casos

| ID | Prioridade | Requisito |
|---|---:|---|
| ALT-001 | P1 | Gerar alertas a partir de regras explicáveis. |
| ALT-002 | P1 | Priorizar alertas por severidade e risco. |
| CAS-001 | P1 | Abrir, atribuir, comentar e concluir casos. |
| CAS-002 | P1 | Registrar evidências e decisões humanas. |
| CAS-003 | P1 | Controlar prazos internos e escalonamento. |
| CAS-004 | P2 | Gerar rascunho de narrativa assistida por IA. |

### 9.5 Auditoria e relatórios

| ID | Prioridade | Requisito |
|---|---:|---|
| AUD-001 | P0 | Registrar eventos de segurança, configuração e avaliação. |
| AUD-002 | P0 | Preservar versão de política e códigos de motivo. |
| AUD-003 | P0 | Impedir alteração silenciosa de eventos de auditoria. |
| REP-001 | P0 | Filtrar e exportar avaliações autorizadas. |
| REP-002 | P1 | Gerar relatórios executivos e operacionais. |
| REP-003 | P2 | Gerar pacotes de evidência para auditoria externa. |

### 9.6 Integrações e notificações

| ID | Prioridade | Requisito |
|---|---:|---|
| API-001 | P0 | Versionar endpoints e contratos. |
| API-002 | P0 | Autenticar sistemas por credenciais de máquina. |
| API-003 | P0 | Aplicar limites por tenant e credencial. |
| API-004 | P0 | Assinar webhooks e permitir retentativas. |
| API-005 | P0 | Disponibilizar sandbox isolado. |
| API-006 | P1 | Permitir rotação de segredo sem interrupção. |
| CON-001 | P1 | Padronizar conectores externos por uma interface comum. |
| CON-002 | P1 | Aplicar timeout e circuito de proteção por fornecedor. |

### 9.7 Cobrança e consumo

| ID | Prioridade | Requisito |
|---|---:|---|
| BIL-001 | P0 | Medir avaliações, transações, usuários e conectores usados. |
| BIL-002 | P0 | Vincular tenant a plano e franquia. |
| BIL-003 | P1 | Alertar sobre aproximação de limite. |
| BIL-004 | P1 | Gerar extrato de consumo conciliável. |
| BIL-005 | P2 | Automatizar upgrade, cobrança e bloqueio comercial controlado. |

---

## 10. Motor de risco e motor de política

### 10.1 Separação conceitual

O produto terá duas camadas lógicas:

1. **Motor de risco:** interpreta os dados e calcula exposição por dimensão.
2. **Motor de política:** aplica os parâmetros da empresa e produz classificação, pendências e ação recomendada.

A decisão final, como permitir jogo, conceder crédito ou bloquear operação, permanece no sistema da contratante.

### 10.2 Pipeline de cálculo

```text
Dados recebidos
    → normalização
    → validação e completude
    → enriquecimentos autorizados
    → regras por dimensão
    → score por dimensão
    → cálculo da qualidade e incerteza
    → agregação ponderada
    → faixa de risco
    → códigos de motivo
    → pendências e recomendação
    → evidência auditável
```

### 10.3 Dimensões iniciais

- lavagem de dinheiro;
- fraude;
- sanções e financiamento ao terrorismo;
- crédito;
- reputação e imagem;
- financeiro;
- operacional;
- comportamento transacional.

A lista deverá ser configurável. Para o MVP, apenas as dimensões validadas pelo especialista do nicho serão ativadas.

### 10.4 Convenção proposta de score

- Escala numérica de 0 a 100.
- 0 representa menor exposição e 100 maior exposição.
- Cada dimensão possui score próprio.
- O score consolidado utiliza pesos da política publicada.
- Faixas de baixo, médio e alto são configuradas por tenant.
- Qualidade dos dados é exibida separadamente do risco.
- Ausência de dado não deve ser confundida silenciosamente com risco comprovado.

### 10.5 Explicabilidade

Cada resultado deverá incluir:

- fatores avaliados;
- regras acionadas;
- contribuição de cada fator;
- códigos de motivo padronizados;
- dados ausentes ou inconsistentes;
- fontes consultadas;
- versão de política;
- horário do cálculo;
- indicação de resultado preliminar ou final.

### 10.6 Uso de inteligência artificial

No MVP, IA não será responsável pelo score central. Usos posteriores permitidos:

- extração de campos de documentos;
- resumo de evidências;
- sugestão de narrativa para casos;
- priorização assistida;
- detecção de padrões e anomalias;
- ajuda na criação de regras.

Qualquer saída de IA deverá informar modelo, versão, contexto, confiança e necessidade de revisão humana quando afetar uma análise.

---

## 11. Arquitetura de solução

### 11.1 Visão lógica

```text
Sistemas da empresa contratante
        │
        ▼
API Gateway / WAF / autenticação de máquina
        │
        ├── Serviço de tenants e identidade
        ├── Serviço de políticas e versionamento
        ├── Serviço de avaliações
        ├── Motor de risco e regras
        ├── Orquestrador de conectores
        ├── Serviço de casos e auditoria
        ├── Serviço de webhooks e notificações
        └── Medição de consumo e cobrança
        │
        ├── PostgreSQL transacional
        ├── Redis para cache, locks e idempotência
        ├── Armazenamento de objetos para evidências
        └── Fila/event stream para processamento assíncrono
```

### 11.2 Estratégia de implementação

- Monólito modular no MVP.
- Limites claros por domínio no código e no banco.
- Processadores assíncronos separados para conectores, webhooks e transações.
- Eventos internos com contratos versionados.
- Extração para microsserviços somente quando escala, isolamento ou equipe justificarem.
- Infraestrutura reproduzível e ambientes separados: desenvolvimento, sandbox, homologação e produção.

### 11.3 Stack técnica recomendada

Esta é uma recomendação, não uma decisão irrevogável:

- **Frontend:** React com Next.js e TypeScript.
- **Backend principal:** TypeScript com NestJS/Fastify ou arquitetura equivalente.
- **Motor analítico futuro:** serviço Python isolado apenas quando modelos estatísticos forem necessários.
- **Banco transacional:** PostgreSQL.
- **Cache e idempotência:** Redis.
- **Eventos:** serviço gerenciado de fila no MVP; Kafka ou Redpanda apenas se o volume justificar.
- **Objetos e documentos:** armazenamento compatível com S3.
- **Autenticação:** provedor gerenciado com MFA e suporte futuro a SSO.
- **Observabilidade:** logs estruturados, métricas, traces e alertas centralizados.
- **Infraestrutura:** contêineres e infraestrutura como código; orquestração simples no início.

### 11.4 Por que monólito modular

- Menor tempo de construção.
- Transações de banco mais simples.
- Menor custo operacional.
- Depuração e testes mais fáceis.
- Permite separar módulos futuros sem assumir a complexidade de microsserviços cedo demais.

---

## 12. Frontend

### 12.1 Estrutura de navegação

1. Visão geral.
2. Avaliações.
3. Alertas.
4. Casos.
5. Clientes, sempre restritos ao tenant.
6. Políticas e regras.
7. Relatórios e auditoria.
8. Integrações e API.
9. Usuários e segurança.
10. Consumo e cobrança.

Itens ainda não disponíveis por fase deverão ser ocultados por feature flag.

### 12.2 Princípios de experiência

- Explicação antes de ação.
- Risco, incerteza e pendência visualmente distintos.
- Status consistentes entre interface, API e webhook.
- Filtros reproduzíveis e exportações auditadas.
- Confirmação reforçada para publicar política ou alterar segurança.
- Acessibilidade desde o design inicial.
- Dados sensíveis mascarados por padrão.
- Datas, moedas e fuso horário configurados por tenant.
- Interface responsiva, priorizando desktop para analistas.

### 12.3 Telas P0

- Login, MFA e recuperação.
- Seleção de ambiente.
- Dashboard básico.
- Lista e detalhe de avaliações.
- Explicação do score.
- Lista de pendências.
- Editor de política.
- Comparação entre rascunho e versão publicada.
- Gestão de usuários e papéis.
- Credenciais, webhooks e sandbox.
- Auditoria.
- Consumo.

### 12.4 Estados obrigatórios

Toda tela de operação deverá prever:

- carregando;
- vazia;
- sem permissão;
- erro recuperável;
- erro de integração;
- dado parcial;
- resultado preliminar;
- resultado final;
- conteúdo mascarado;
- serviço indisponível.

---

## 13. Backend

### 13.1 Módulos de domínio

| Módulo | Responsabilidade |
|---|---|
| Tenancy | Contexto, isolamento, região, plano e feature flags. |
| Identity & Access | Usuários, máquinas, papéis, sessões e MFA. |
| Policy | Fatores, regras, pesos, templates, aprovação e versões. |
| Assessment | Ciclo de vida da avaliação e normalização da entrada. |
| Scoring | Execução determinística e agregação dos scores. |
| Connector | Integrações externas, timeouts, cache e evidências. |
| Transaction | Ingestão e processamento de eventos transacionais. |
| Alert & Case | Alertas, investigação, tarefas e conclusão humana. |
| Evidence & Audit | Evidência imutável e reconstrução de eventos. |
| Notification | Webhooks, e-mails operacionais e retentativas. |
| Usage & Billing | Medição, franquia, excedente e extrato. |
| Platform Ops | Saúde, suporte auditado e configuração global. |

### 13.2 Padrões obrigatórios

- `tenant_id` derivado da identidade autenticada, nunca confiado a partir do corpo da requisição.
- Idempotência em comandos externos.
- Controle de concorrência ao editar políticas.
- Datas armazenadas em UTC.
- Identificadores opacos e não sequenciais em APIs.
- Erros com código estável e mensagem segura.
- Logs sem CPF, documento, endereço, token ou payload integral.
- Transações de banco nos limites de consistência necessários.
- Outbox transacional para publicação confiável de eventos.
- Feature flags por tenant e ambiente.

### 13.3 Estados de avaliação propostos

`received`, `validating`, `pending_data`, `enriching`, `scoring`, `preliminary`, `completed`, `manual_review`, `failed`, `cancelled`.

Transições inválidas devem ser recusadas e auditadas.

---

## 14. API e integrações

### 14.1 Princípios

- REST/JSON no MVP.
- Versão explícita no caminho.
- OAuth 2.0 Client Credentials ou mecanismo gerenciado equivalente.
- Chave de idempotência obrigatória para criação.
- Webhooks assinados por HMAC.
- Paginação por cursor.
- Códigos e formatos de erro estáveis.
- Limites por tenant, endpoint e credencial.
- OpenAPI como contrato executável.
- Compatibilidade retroativa dentro da versão principal.

### 14.2 Endpoints iniciais

| Método | Endpoint | Finalidade |
|---|---|---|
| POST | `/v1/assessments` | Criar avaliação. |
| GET | `/v1/assessments/{id}` | Consultar estado e resultado. |
| POST | `/v1/assessments/{id}/supplements` | Enviar informação adicional. |
| POST | `/v1/assessments/{id}/reassess` | Solicitar nova avaliação. |
| GET | `/v1/policies/active` | Consultar versão ativa autorizada. |
| POST | `/v1/transactions` | Ingerir evento transacional na fase 2. |
| GET | `/v1/alerts` | Consultar alertas. |
| GET | `/v1/cases/{id}` | Consultar caso autorizado. |
| POST | `/v1/webhook-endpoints` | Configurar destino de webhook. |
| GET | `/v1/usage` | Consultar consumo. |

### 14.3 Exemplo conceitual de retorno

```json
{
  "assessment_id": "asm_opaque_id",
  "external_reference": "customer-123",
  "status": "completed",
  "is_final": true,
  "policy_version": "policy_2026_09_001",
  "overall": {
    "score": 72,
    "band": "high"
  },
  "dimensions": [
    {"code": "fraud", "score": 81, "band": "high"},
    {"code": "credit", "score": 48, "band": "medium"}
  ],
  "data_quality": {
    "score": 86,
    "missing_fields": ["income_source_evidence"]
  },
  "reason_codes": ["IDENTITY_DATA_MISMATCH", "INCOME_EVIDENCE_MISSING"],
  "recommended_action": "manual_review",
  "calculated_at": "2026-09-11T15:00:00Z"
}
```

`recommended_action` é uma recomendação configurada pela empresa; não representa decisão jurídica ou operacional tomada pelo SaaS.

### 14.4 Webhooks

Eventos iniciais:

- `assessment.preliminary`;
- `assessment.completed`;
- `assessment.updated`;
- `assessment.failed`;
- `alert.created`;
- `case.updated`;
- `usage.threshold_reached`.

Requisitos:

- assinatura e timestamp;
- prevenção contra replay;
- identificador único de evento;
- entrega pelo menos uma vez;
- consumidor deve ser idempotente;
- retentativa exponencial;
- painel para inspecionar e reenviar;
- descarte controlado após limite, com alerta.

---

## 15. Dados e banco de dados

### 15.1 Entidades principais

| Entidade | Finalidade |
|---|---|
| Tenant | Empresa contratante e sua configuração-base. |
| TenantEnvironment | Sandbox, homologação e produção. |
| User, Role, Permission | Identidade e autorização. |
| ApiClient | Credencial de integração. |
| RiskPolicy | Cabeçalho da política. |
| PolicyVersion | Versão publicada e imutável. |
| RiskDimension | Dimensão de risco. |
| RiskFactor | Fator avaliado. |
| Rule | Condição, contribuição e motivo. |
| CustomerReference | Referência pseudonimizada dentro do tenant. |
| Assessment | Ciclo de vida da avaliação. |
| InputSnapshot | Evidência mínima dos dados usados. |
| DimensionScore | Resultado por dimensão. |
| ReasonCode | Explicação padronizada. |
| MissingRequirement | Pendência de informação. |
| TransactionEvent | Evento transacional da fase 2. |
| Alert | Sinal gerado por regra ou anomalia. |
| Case | Investigação e conclusão humana. |
| Evidence | Referência a documento ou resultado externo. |
| AuditEvent | Evento imutável de auditoria. |
| WebhookDelivery | Tentativas de notificação. |
| UsageRecord | Medição faturável. |
| Subscription | Plano, período e franquia. |

### 15.2 Estratégia multi-tenant

Recomendação para o MVP:

- esquema compartilhado com `tenant_id` em todas as tabelas de domínio;
- Row-Level Security no PostgreSQL;
- filtro obrigatório no repositório da aplicação;
- contexto de tenant validado em cada requisição e job;
- testes automatizados de isolamento;
- chaves e caches sempre prefixados por tenant;
- nenhuma consulta administrativa ampla sem permissão especial e auditoria.

Para clientes enterprise, oferecer no futuro banco, schema ou ambiente dedicado.

### 15.3 Classificação dos dados

- **Público:** documentação comercial aprovada.
- **Interno:** configurações e métricas sem identificação pessoal.
- **Confidencial:** políticas, scores, relatórios e dados comerciais.
- **Restrito:** CPF, RG, endereço, nascimento, documentos, evidências e credenciais.

### 15.4 Retenção proposta

- Configurável por tenant e categoria.
- Períodos finais dependem de validação jurídica e contratual.
- Separar dado operacional, evidência de cálculo e log de segurança.
- Permitir anonimização quando a identificação completa não for mais necessária.
- Suportar exclusão controlada e bloqueio por obrigação de retenção.
- Backups devem respeitar expiração documentada e criptografada.

### 15.5 Zero retenção

Uma modalidade de processamento com retenção mínima pode ser criada, mas há um conflito estrutural: reconstruir uma avaliação exige conhecer entradas, política e resultado. As opções são:

1. Reter snapshot criptografado completo.
2. Reter apenas campos derivados, hashes e evidências mínimas.
3. Deixar a evidência completa com a contratante e armazenar somente referência assinada.

A escolha será contratual e técnica; não deve ser prometida antes de uma prova de reconstrução auditável.

---

## 16. Processamento e consultas em tempo real

### 16.1 Definições

- **Onboarding síncrono:** cálculo interno simples retornado na mesma chamada.
- **Onboarding assíncrono:** avaliação depende de terceiros ou processamento demorado.
- **Monitoramento em tempo quase real:** evento confirmado rapidamente e processado por fila.
- **Decisão inline:** resposta exigida antes da empresa continuar a transação; não recomendada para o MVP.

### 16.2 Metas técnicas propostas

| Operação | Meta inicial |
|---|---|
| Confirmação de recebimento | p95 até 500 ms |
| Score somente com dados internos | p95 até 2 s |
| Consulta de avaliação | p95 até 500 ms |
| Atualização do dashboard | até 5 s após processamento |
| Entrega inicial de webhook | até 5 s após conclusão |
| Avaliação com terceiros | prazo específico por conector, com timeout |

### 16.3 Arquitetura de eventos

- A API confirma após validar e persistir o evento.
- Processamento pesado ocorre fora da requisição.
- Eventos carregam tenant, versão, correlação e idempotência.
- Ordenação será garantida quando necessária por cliente ou conta.
- Falhas seguem para retentativa e fila de exceções.
- Agregados transacionais são atualizados incrementalmente.
- Painel recebe atualização por consulta periódica; SSE ou WebSocket apenas se a experiência exigir.

### 16.4 Contingência

A empresa deverá escolher e documentar o comportamento quando o SaaS estiver indisponível. Possibilidades:

- continuar com limites conservadores;
- enviar para análise manual;
- manter transação pendente;
- aplicar regra local de contingência.

O SaaS não deverá impor bloqueio automático sem contrato, arquitetura e risco jurídico validados.

---

## 17. Segurança, privacidade e criptografia

### 17.1 Princípios

- Privacidade desde o desenho.
- Menor privilégio.
- Negação por padrão.
- Separação de funções.
- Defesa em profundidade.
- Evidência de todas as ações privilegiadas.
- Nenhuma informação sensível em logs comuns.

### 17.2 Criptografia

- TLS 1.3 para tráfego externo sempre que suportado.
- TLS entre componentes internos sensíveis.
- AES-256-GCM ou serviço gerenciado equivalente para dados em repouso.
- Criptografia de envelope com chaves protegidas por KMS/HSM.
- Chaves separadas por ambiente; opção de chave por tenant enterprise.
- Criptografia em nível de campo para documentos e identificadores críticos.
- Segredos armazenados em cofre, nunca em código ou banco comum.
- Rotação documentada de chaves, segredos e credenciais.
- Backups e exportações também criptografados.

### 17.3 Identidade e acesso

- MFA para administradores e analistas privilegiados.
- Sessões curtas para ações críticas.
- Autorização no backend, independentemente da interface.
- SSO enterprise em fase posterior.
- Contas de máquina separadas de contas humanas.
- Escopos de API mínimos.
- Acesso de suporte temporário, aprovado, justificado e gravado.
- Revisão periódica de acessos.

### 17.4 Proteção de dados

- Mascaramento de CPF, documentos e endereço na interface.
- Tokenização ou pseudonimização para referências internas.
- Redação automática em logs e ferramentas de observabilidade.
- Download e exportação sujeitos a permissão e auditoria.
- Ambientes de desenvolvimento sem dados reais.
- Dados de teste sintéticos.
- Avaliação de impacto de privacidade antes do piloto.

### 17.5 Segurança do desenvolvimento

- Revisão obrigatória de código.
- Análise de dependências e segredos.
- Testes estáticos, dinâmicos e de API.
- Modelagem de ameaças por fluxo crítico.
- Testes específicos de isolamento de tenant.
- Pentest antes de clientes regulados em produção.
- Gestão de vulnerabilidades com prazos por severidade.
- Imagens e dependências fixadas e verificadas.

### 17.6 Responsabilidades de privacidade

O contrato deverá definir empresa contratante, operador/processador, suboperadores, finalidade, base legal, retenção, atendimento a titulares, incidente e transferência internacional. Essas definições exigem validação jurídica; o produto não deverá assumi-las apenas por arquitetura.

---

## 18. Auditoria, explicabilidade e governança regulatória

### 18.1 Evidência mínima de cada avaliação

- tenant e ambiente;
- referência externa e identificador interno;
- identidade técnica que solicitou;
- horário de recebimento e conclusão;
- versão do contrato de API;
- versão da política;
- fatores e regras executados;
- fontes consultadas;
- scores por dimensão;
- classificação consolidada;
- qualidade e pendências;
- códigos de motivo;
- alterações ou conclusões humanas;
- hash ou referência da evidência utilizada.

### 18.2 Imutabilidade

- Políticas publicadas não podem ser editadas.
- Correções geram nova versão.
- Eventos de auditoria devem ser append-only.
- Exportações devem conter identificador e hash de integridade.
- Exclusões exigidas devem gerar registro sem preservar conteúdo indevido.

### 18.3 Segregação de funções

- Criador de política não deve necessariamente publicá-la.
- Analista não deve alterar retroativamente a regra usada.
- Administrador técnico não deve concluir caso de risco sem permissão.
- Suporte do SaaS não deve acessar dados sensíveis por padrão.

### 18.4 Reporte regulatório

No MVP, a plataforma deverá organizar evidências e exportações internas. Envio automático a autoridades ficará fora de escopo até haver validação de jurisdição, formato, responsabilidade, assinatura e revisão humana.

---

## 19. Requisitos não funcionais e níveis de serviço

### 19.1 Disponibilidade e continuidade

- Meta inicial de 99,9% mensal após o piloto.
- Componentes críticos distribuídos entre zonas quando o provedor permitir.
- Backups automáticos e testes periódicos de restauração.
- RPO proposto de 15 minutos.
- RTO proposto de 4 horas no plano padrão.
- Planos enterprise poderão contratar metas superiores.

### 19.2 Desempenho

- Metas por endpoint monitoradas no percentil 95 e 99.
- Testes de carga com empresa fictícia.
- Proteção contra clientes ruidosos.
- Paginação obrigatória em coleções.
- Consultas pesadas executadas de modo assíncrono.
- Índices orientados pelos padrões reais de consulta.

### 19.3 Escalabilidade

- Aplicação stateless quando possível.
- Workers escaláveis horizontalmente.
- Particionamento de eventos por tenant ou referência.
- Arquivamento de histórico conforme retenção.
- Limites de uso explícitos por plano.

### 19.4 Observabilidade

- Métricas de produto, infraestrutura e integração.
- Logs estruturados com correlação.
- Rastreamento distribuído nos fluxos críticos.
- Alertas por impacto ao cliente, não apenas uso de CPU.
- Painel de SLO e orçamento de erro.
- Status por conector externo.

### 19.5 Compatibilidade e acessibilidade

- Duas versões mais recentes dos principais navegadores corporativos.
- Interface de acordo com práticas reconhecidas de acessibilidade.
- Idioma e formatação regional desacoplados do código.

---

## 20. Operação, suporte e resposta a incidentes

### 20.1 Ambientes

- Desenvolvimento local sem dados reais.
- Ambiente compartilhado de desenvolvimento.
- Sandbox por tenant para integração.
- Homologação próxima de produção.
- Produção com controles reforçados.

### 20.2 Processo de implantação

1. Alteração revisada e testes automatizados.
2. Migração compatível com versão anterior.
3. Implantação em homologação.
4. Testes de fumaça e contrato.
5. Implantação gradual em produção.
6. Monitoramento de métricas e erros.
7. Rollback ou desativação por feature flag quando necessário.

### 20.3 Suporte

| Severidade | Exemplo | Resposta inicial proposta |
|---|---|---|
| S1 | Indisponibilidade ampla, vazamento ou risco de integridade | 15 minutos, cobertura contratada |
| S2 | Função crítica degradada ou avaliações paradas | 1 hora |
| S3 | Falha parcial com alternativa | 4 horas úteis |
| S4 | Dúvida, melhoria ou problema cosmético | 1 dia útil |

Tempos definitivos dependerão do plano e da capacidade operacional.

### 20.4 Resposta a incidentes

- Detecção e abertura automática.
- Nomeação de Incident Commander.
- Contenção e proteção dos dados.
- Comunicação por canal e periodicidade definidos.
- Preservação de evidências.
- Recuperação e validação.
- Análise de causa sem culpabilização individual.
- Plano de ação com owner e prazo.
- Avaliação jurídica de notificações obrigatórias.

### 20.5 Runbooks mínimos

- API indisponível.
- Fila acumulada.
- Conector externo degradado.
- Webhook falhando.
- Suspeita de vazamento entre tenants.
- Credencial comprometida.
- Score divergente.
- Publicação incorreta de política.
- Falha de migração.
- Restauração de backup.

---

## 21. Modelo de cobrança e receita recorrente

### 21.1 Modelo recomendado

Combinação de assinatura recorrente e consumo:

1. **Taxa de implantação:** configuração, integração, template e treinamento.
2. **Mensalidade da plataforma:** acesso, usuários, ambientes, suporte e franquia.
3. **Uso excedente:** avaliações e eventos transacionais além da franquia.
4. **Conectores externos:** repasse ou margem sobre consultas de terceiros.
5. **Add-ons:** SSO, ambiente dedicado, chave própria, SLA, relatórios e retenção especial.

### 21.2 Planos conceituais

| Plano | Público | Estrutura sugerida |
|---|---|---|
| Pilot | Primeiro caso de uso | Um ambiente, usuários limitados, onboarding e suporte assistido. |
| Growth | Empresas digitais em expansão | Maior franquia, políticas avançadas, webhooks e monitoramento. |
| Enterprise | Operações reguladas ou de alto volume | Contrato anual, SSO, ambiente dedicado, SLA e segurança ampliada. |

Não definir preços antes de medir custo por avaliação, custo por conector, infraestrutura, suporte e disposição a pagar.

### 21.3 Unidade de cobrança

Unidades possíveis:

- avaliação iniciada;
- avaliação finalizada;
- reavaliação;
- mil eventos transacionais;
- consulta a fonte externa;
- usuário ativo;
- caso investigado;
- armazenamento e retenção adicional.

Recomendação: cobrar mensalidade com franquia de avaliações e transações, excedente por uso e conectores separados. Usuário não deve ser o principal limitador, pois isso desestimula adoção interna.

### 21.4 Recorrência e contratos

- Cobrança mensal antecipada para planos padrão.
- Opção anual com desconto comercial.
- Contratos enterprise com compromisso mínimo e volume negociado.
- Medição diária e fechamento mensal.
- Alertas em 70%, 90% e 100% da franquia.
- Período de tolerância e procedimento de inadimplência sem bloqueio abrupto de fluxo crítico.

### 21.5 Métricas financeiras

- MRR e ARR.
- Receita de implantação separada da receita recorrente.
- Receita líquida por tenant.
- Margem bruta.
- Custo por avaliação e por mil transações.
- Expansão, contração e churn.
- Retenção líquida de receita.
- Prazo de recuperação do custo de aquisição.

---

## 22. Owners, equipe e governança do projeto

### 22.1 Owners necessários

| Papel | Accountability principal |
|---|---|
| Sponsor/Fundador | Visão, capital, decisões estratégicas e acesso ao mercado. |
| Product Owner | PRD, prioridade, escopo e aceite funcional. |
| Project Manager | Cronograma, dependências, riscos e comunicação. |
| Especialista de Risco/Compliance | Fatores, regras, casos e validação regulatória. |
| Tech Lead/Arquiteto | Arquitetura, padrões técnicos e decisões de engenharia. |
| Backend Owner | API, motor, integrações e consistência. |
| Frontend Owner | Portal, experiência, acessibilidade e design system. |
| Data/Risk Engine Owner | Modelo de score, dados, qualidade e calibração. |
| Security/Privacy Owner | Ameaças, controles, incidentes e privacidade. |
| DevOps/SRE Owner | Ambientes, entrega, observabilidade e continuidade. |
| QA Owner | Estratégia de testes e evidência de qualidade. |
| Customer Success Owner | Onboarding da empresa, treinamento e adoção. |
| Finance/Billing Owner | Planos, medição, faturamento e margem. |

Uma pessoa pode acumular papéis no início, mas cada área precisa ter um owner nominal antes do desenvolvimento.

### 22.2 RACI resumido

| Entrega | Sponsor | Product | Compliance | Tech Lead | Engenharia | Security | QA |
|---|---|---|---|---|---|---|---|
| Nicho e proposta de valor | A | R | C | C | I | I | I |
| Taxonomia e regras | I | A | R | C | C | C | C |
| Arquitetura | I | C | C | A/R | R | C | C |
| Modelo de dados | I | C | C | A | R | C | C |
| Segurança e privacidade | I | C | C | C | R | A/R | C |
| UX e fluxos | I | A | C | C | R | C | C |
| Qualidade e aceite | I | A | C | C | R | C | R |
| Piloto | A | R | R | C | C | C | C |
| Go-live | A | R | C | R | R | R | R |

Legenda: **R** executa, **A** responde pelo resultado, **C** consultado, **I** informado.

### 22.3 Cadência de governança

- Daily de engenharia: 15 minutos.
- Planejamento e revisão de sprint: quinzenal.
- Demonstração para negócio: quinzenal.
- Comitê de produto e risco: semanal durante descoberta e piloto.
- Revisão de segurança: em cada marco relevante.
- Steering executivo: mensal.
- Registro de decisões arquiteturais para mudanças estruturais.
- Registro de riscos atualizado semanalmente.

### 22.4 Equipe mínima sugerida

- 1 Product Owner/PM.
- 1 especialista de risco/compliance com dedicação relevante.
- 1 Tech Lead full stack.
- 2 engenheiros backend.
- 1 engenheiro frontend.
- 1 QA com automação.
- DevOps/SRE e segurança compartilhados inicialmente.
- UX/UI parcial durante descoberta e construção do portal.

---

## 23. Plano de execução e cronograma

Estimativa para equipe mínima já formada. Não é compromisso comercial até que dados, integrações e equipe sejam confirmados.

### Etapa 0 — Descoberta fechada, 2 a 3 semanas

- Resolver as dez decisões críticas.
- Escolher quatro concorrentes.
- Definir piloto e caso de uso.
- Fechar dicionário de dados.
- Definir taxonomia e política de exemplo.
- Aprovar wireframes.
- Validar modelo de responsabilidade e retenção.

**Saída:** PRD 1.0, protótipo e backlog priorizado.

### Etapa 1 — Fundação da plataforma, 3 a 4 semanas

- Repositórios, ambientes e entrega contínua.
- Tenancy, identidade e autorização.
- Estrutura do banco.
- Auditoria básica.
- API gateway e credenciais.
- Esqueleto do portal.

**Saída:** tenant criado, usuários autenticados e sandbox acessível.

### Etapa 2 — Motor e onboarding, 5 a 6 semanas

- Editor e versionamento de política.
- Validação de entrada.
- Motor de regras.
- Scores e códigos de motivo.
- API de avaliações.
- Webhooks.
- Telas de lista e detalhe.

**Saída:** fluxo completo executado com empresa fictícia.

### Etapa 3 — Auditoria, operação e cobrança, 3 a 4 semanas

- Trilhas completas.
- Relatórios e exportações.
- Gestão de pendências.
- Medição de consumo.
- Painéis operacionais.
- Runbooks e suporte.

**Saída:** candidato a piloto.

### Etapa 4 — Segurança, carga e piloto, 3 a 4 semanas

- Testes de isolamento e segurança.
- Teste de carga e falhas.
- Restauração de backup.
- Correções do piloto.
- Treinamento e aceite.

**Saída:** MVP em produção controlada.

### Prazo indicativo

**16 a 21 semanas** para o MVP piloto, após fechar requisitos, equipe e dependências externas.

### Monitoramento transacional

Adicionar de 6 a 10 semanas após estabilização do onboarding, dependendo do volume, regras e necessidade de decisão inline.

---

## 24. Estratégia de qualidade e testes

### 24.1 Pirâmide de testes

- Testes unitários no motor e regras.
- Testes de propriedade para limites de score.
- Testes de integração com banco, fila e cache.
- Testes de contrato da API e webhooks.
- Testes end-to-end das jornadas críticas.
- Testes de migração de banco.
- Testes de carga, pico e soak.
- Testes de caos controlado em conectores e fila.
- Testes de segurança e autorização.
- Testes explícitos de isolamento de tenant.

### 24.2 Casos sintéticos obrigatórios

- Cliente de baixo risco com dados completos.
- Cliente de alto risco com múltiplos fatores.
- Dados insuficientes.
- Informação inconsistente.
- Solicitação duplicada.
- Conector indisponível.
- Política alterada durante avaliação.
- Cliente reavaliado.
- Tentativa de acesso por outro tenant.
- Evento transacional fora de ordem.
- Webhook indisponível.
- Grande pico de cadastros.

### 24.3 Definition of Done

Uma entrega só está pronta quando:

- critérios de aceite foram atendidos;
- testes automatizados relevantes passaram;
- autorização e isolamento foram testados;
- logs e métricas foram adicionados;
- não há dado sensível em logs;
- migração e rollback foram avaliados;
- documentação da API e operação foi atualizada;
- mudança foi validada em homologação;
- Product Owner aceitou o comportamento;
- owner operacional e runbook existem para função crítica.

---

## 25. Riscos operacionais e técnicos

| Risco | Probabilidade | Impacto | Mitigação | Owner |
|---|---|---|---|---|
| Vazamento entre tenants | Baixa | Crítico | RLS, autorização em camadas, testes, criptografia e revisão de acesso. | Security + Tech Lead |
| Score incorreto por regra defeituosa | Média | Alto | Versionamento, simulação, revisão, casos dourados e rollback. | Risk Engine Owner |
| Política mal configurada pela empresa | Alta | Alto | Templates, validações, aprovação dupla e ambiente de simulação. | Product + Compliance |
| Falta de evidência auditável | Média | Alto | Snapshot mínimo, política imutável, auditoria append-only e teste de reconstrução. | Compliance + Backend |
| Indisponibilidade de fornecedor externo | Alta | Médio/Alto | Timeout, circuito de proteção, cache permitido, resposta parcial e fallback. | Backend Owner |
| Onboarding lento e abandono | Média | Alto | Caminho rápido, processamento assíncrono, metas de latência e medição por conector. | Tech Lead + Product |
| Falsos positivos excessivos | Alta | Alto | Calibração, revisão humana, métricas e ajuste por versão. | Compliance |
| Falsos negativos | Média | Crítico | Casos de teste, monitoramento posterior, revisão de regras e feedback. | Compliance + Data |
| PII em logs ou suporte | Média | Crítico | Redação, mascaramento, políticas de logging e testes automáticos. | Security |
| Escopo amplo demais | Alta | Alto | Um nicho, um país, onboarding primeiro e critérios rígidos de mudança. | Product Owner |
| Dependência de um único especialista | Alta | Alto | Documentação, workshops, revisão por pares e matriz de decisão. | Sponsor |
| Custo imprevisível de terceiros | Média | Alto | Medição por consulta, limites, repasse e contratos. | Finance + Product |
| Eventos duplicados ou fora de ordem | Alta | Médio | Idempotência, versionamento, sequência e processamento determinístico. | Backend Owner |
| Alteração regulatória | Média | Alto | Policies configuráveis, acompanhamento jurídico e atualização de templates. | Compliance |
| Uso indevido de IA | Média | Alto | IA assistiva, revisão humana, logs de modelo e proibição de decisão opaca. | AI/Data + Security |
| Falha no modelo de cobrança | Média | Alto | Telemetria desde o MVP, pilotos pagos e análise de margem. | Finance + Sponsor |

---

## 26. Métricas de produto, operação e negócio

### 26.1 Produto

- Tempo até primeira avaliação válida.
- Percentual de avaliações concluídas.
- Percentual pendente por dado faltante.
- Tempo médio e p95 de avaliação.
- Taxa de revisão manual.
- Distribuição por faixa de risco.
- Uso de códigos de motivo.
- Adoção por perfil de usuário.

### 26.2 Eficácia de risco

- Alertas confirmados e descartados.
- Falsos positivos e falsos negativos, quando houver resultado conhecido.
- Tempo até investigar um alerta.
- Percentual de reavaliações que mudam de faixa.
- Regras com maior contribuição e maior taxa de descarte.
- Cobertura de dados por dimensão.

### 26.3 Operação técnica

- Disponibilidade.
- Latência p50, p95 e p99.
- Erros por endpoint.
- Profundidade e atraso da fila.
- Sucesso de webhooks.
- Falha e latência por conector.
- Incidentes por severidade.
- RPO/RTO observado em testes.
- Violações de isolamento: meta zero.

### 26.4 Negócio

- MRR e ARR.
- Conversão de piloto em contrato.
- Tempo de implantação.
- Receita e margem por tenant.
- Expansão de consumo.
- Churn e retenção líquida.
- Custo de suporte por tenant.
- Custo unitário por avaliação e por mil transações.

---

## 27. Critérios de aceite do MVP

O MVP estará apto para piloto quando:

1. Duas empresas fictícias operarem sem qualquer acesso cruzado.
2. Um administrador configurar e publicar uma política versionada.
3. A API receber uma avaliação idempotente e validar seu payload.
4. O motor retornar scores, faixa, motivos, qualidade e pendências.
5. A mesma entrada puder ser avaliada por políticas diferentes sem contaminar tenants.
6. A empresa receber o resultado por consulta e webhook assinado.
7. Um auditor reconstruir qual política e quais fatores produziram o resultado.
8. Dados sensíveis estiverem criptografados e mascarados.
9. Perfis de acesso impedirem ações não autorizadas.
10. Testes de carga atenderem às metas acordadas.
11. Backups forem restaurados com sucesso em exercício documentado.
12. Runbooks e alertas existirem para falhas críticas.
13. Consumo por tenant for medido e conciliável.
14. O especialista de risco aprovar os casos sintéticos.
15. O Product Owner assinar o aceite do piloto.

---

## 28. Decisões pendentes

As dez respostas abaixo são necessárias para transformar este PRD 0.1 em PRD 1.0:

1. Qual será o primeiro nicho, país e tipo de empresa do piloto?
2. Quais campos e documentos serão obrigatórios no onboarding?
3. Quais fontes externas serão usadas, quem as contrata e quem paga cada consulta?
4. Qual prazo de retorno é aceitável para resposta preliminar e final?
5. Quais dados o SaaS poderá armazenar e por quanto tempo?
6. O score base será comum e apenas a aceitação variará, ou todo o cálculo será customizado por empresa?
7. Quais dimensões e fatores formarão a primeira política real?
8. O retorno incluirá somente classificação ou também ação recomendada e pendências?
9. Qual volume esperado de cadastros e transações no primeiro ano?
10. Quais exigências mínimas de hospedagem, segurança, auditoria e certificação têm os primeiros clientes?

Também são necessários os nomes de **quatro concorrentes ou produtos de referência** para comparação de posicionamento, recursos, integração e cobrança.

---

## 29. Próximos passos

1. Nomear Sponsor, Product Owner, especialista de risco e Tech Lead.
2. Responder às dez decisões pendentes.
3. Informar quatro concorrentes.
4. Selecionar a empresa e o fluxo do piloto.
5. Realizar workshop de taxonomia e fatores de risco.
6. Criar o dicionário de dados e exemplos de payload.
7. Validar privacidade, retenção e responsabilidade jurídica.
8. Desenhar wireframes das sete visões.
9. Produzir arquitetura física e threat model.
10. Estimar backlog com a equipe responsável.
11. Aprovar PRD 1.0, cronograma e orçamento.
12. Iniciar a fundação técnica e o sandbox.

---

## Registro de decisões da versão 0.1

| Decisão | Estado |
|---|---|
| Produto B2B multi-tenant | Adotada |
| Sem perfil global compartilhado | Adotada |
| Empresa contratante mantém decisão final | Adotada |
| API-first | Adotada |
| Onboarding como primeiro MVP | Recomendada, aguardando aprovação |
| Monitoramento transacional como fase seguinte | Recomendada, aguardando aprovação |
| Monólito modular | Recomendada, aguardando aprovação técnica |
| Regras determinísticas no núcleo inicial | Recomendada, aguardando validação de risco |
| Sete visões operacionais | Recomendada, aguardando validação de usuários |
| Cobrança híbrida: assinatura e consumo | Recomendada, aguardando validação comercial |
