# Plano — Frontend apresentável (10 dias) · Walkthrough Lucimara

**Marco:** apresentação / walkthrough com Lucimara em **26 de outubro de 2026**  
**Início:** 16 de outubro de 2026  
**Dono do resultado:** Cursor (orquestração e entrega) · Merge: Edu  
**Confiança registrada:** Edu, 16/10/2026

## Critério de pronto (não negociável)

Uma pessoa entra sem manual e, de bater o olho, entende:

1. Onde está (empresa, papel, sair)
2. O que fazer (Clientes → avaliar → resultado)
3. O que cada item do menu é e como se conecta
4. Visual de SaaS (sidebar, topbar, marca MITIGA, mobile)
5. Zero texto de engenharia (“ainda conectando…”, “esta tarefa…”)

Se ainda precisar explicar a tela, **não está pronto**.

## Escopo dos 10 dias

| Entra | Não entra |
|---|---|
| Shell real em `/workspace/*` | API v1, cadeia MLRO |
| Hub do tenant + fluxo Clientes CRA | Template v1.1 listas (TASK-036) em paralelo depois |
| Lista / detalhe / avaliação / resultado claros | Migrar todas as 20 rotas protótipo |
| Menu coerente (só o que existe) | Piloto com dados reais de cliente |
| Acessos / rastro legível | Staging completo |

## Calendário

| Dias | Datas | Entrega | Checkpoint com Edu |
|---|---|---|---|
| 1–2 | 16–17/10 | App shell (sidebar/topbar) + hub sem lixo de engenharia | Fim dia 2 |
| 3–4 | 18–19/10 | Lista Clientes apresentável | — |
| 5–6 | 20–21/10 | Detalhe + avaliação + resultado autoexplicativos | Fim dia 5–6 |
| 7 | 22/10 | Fornecedores no mesmo shell ou fora do menu | — |
| 8 | 23/10 | Acessos / quem fez o quê | Checkpoint |
| 9 | 24/10 | Polimento visual + mobile + cópia | — |
| 10 | 25–26/10 | Walkthrough interno + Lucimara | **Apresentação 26/10** |

## Regra de corte

Melhor **4 telas excelentes** do que 12 meias. Se atrasar, corta Fornecedores do menu e protege o fluxo Clientes.

## Branch de trabalho

`feat/workspace-saas-shell-10d` → PRs pequenos para `main`.
