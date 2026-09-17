# PRD — A planilha é a porta de entrada

| | |
|---|---|
| **Data** | 2026-09-16 |
| **Status** | Rascunho para brainstorming. Escrito depois do Plano 1 entrar no ar. |
| **Origem** | Correção de rumo do dono: "a ideia é ele entrar no app e dar de cara com a planilha"; o lançamento manual "deveria ter entrado mais tarde". |
| **Referências** | Spec do Núcleo `docs/superpowers/specs/2026-09-14-nucleo-design.md` · Estrutura real da planilha `docs/referencias/planilha-gastos.md` · Sistema de design `design-system/financecontrol/MASTER.md` e `design-system/financecontrol/AJUSTES-DO-PROJETO.md` |

## 1. O que mudou de entendimento

O Plano 1 entregou login, lançamento manual e a lista do mês. Funciona, mas a primeira tela é um app
vazio esperando digitação. A intenção original é outra:

> O dono abre o app e **vê a planilha dele**. Ele alimenta o sistema **enviando o arquivo**, não
> digitando linha por linha.

O lançamento manual continua existindo — é útil para registrar algo na hora, pelo celular — mas deixa
de ser o centro e vira uma ação secundária.

Isso também reordena o roteiro da spec (§15): a **importação da planilha**, que era o sub-projeto 2,
passa na frente das telas avançadas do Plano 2.

## 2. Objetivo

Que o dono consiga, em menos de um minuto e pelo celular:

1. enviar a planilha `USO_CARTÃO.xlsx`;
2. ver o que o sistema entendeu, antes de gravar;
3. cair numa tela que mostra os dados dele, com o mês corrente à frente.

E que o app pareça um produto, não um formulário: hoje o visual está seco.

## 3. Usuário e contexto

Um único usuário, o dono do cartão. Uso principal no **celular**, muitas vezes em pé, com uma mão, no
mercado ou no caixa. Uso secundário no computador, quando chega a fatura.

É alguém que já confia na própria planilha: o app ganha essa confiança mostrando os mesmos números,
não números novos.

## 4. Escopo

### 4.1 Dentro

**A. Importar a planilha**

- Enviar um arquivo `.xlsx` pela interface (celular e computador).
- Ler a aba **GASTOS** (`Tabela2`; colunas descritas em `docs/referencias/planilha-gastos.md`).
- Mapear: `CÓD` → `id` · `VENCIMENTO` → `mes_fatura` (dia 1) · `ORIGEM` → pessoa · `CATEGORIA` →
  categoria · `ITEM` · `VALOR` → centavos · `PARCELA ATUAL` · `QTD PARCELAS` (`∞` → `recorrente`) ·
  `PAGO?` (vazio → `NAO`) · `fonte = 'planilha'`.
- **Ignorar as colunas calculadas** (`ANO`, `MÊS`, `SUBTOTAL`, `RESTANTE`, `SITUAÇÃO`): elas são
  recalculadas pelas regras R4–R6 que já existem em `src/domain`.
- **Tela de conferência antes de gravar:** quantas linhas foram lidas, quantas são novas, quantas são
  repetidas e quantas têm problema, com o motivo de cada problema. Nada é gravado sem confirmação.
- Relatório pós-importação: valores arredondados para centavos, linhas com `SUBTOTAL` digitado à mão,
  situações que o recálculo mudou.

**B. A planilha como tela inicial**

- Ao entrar, o app abre a visão dos lançamentos, não o formulário.
- Mês corrente à frente, com navegação entre meses e busca.
- Totais visíveis: total do mês, a receber, a abater.

**C. Lançar manual como ação secundária**

- Continua completo, mas sai do centro: vira um botão de ação a partir da tela principal.

**D. Interface de verdade (UI/UX)**

- Aplicar o sistema de design (§6) em todas as telas, as que já existem e as novas.

### 4.2 Fora (por enquanto)

- Importação da **fatura em PDF** (sub-projeto 3 da spec).
- Alterar a planilha original: o arquivo do dono nunca é modificado nem devolvido.

## 5. Perguntas que o brainstorming precisa fechar

1. **A importação é evento único ou rotina?** Migrar o histórico uma vez é diferente de reenviar a
   planilha toda semana. As duas coisas mudam completamente o tratamento de linhas repetidas.
2. **Se for rotina: o que vence?** Substituir tudo, mesclar por `CÓD`, ou só acrescentar o que falta?
   E se uma linha foi marcada como recebida no app e continua vazia na planilha?
3. **Quem é a fonte da verdade depois da primeira importação?** A spec diz que o site substitui a aba
   GASTOS. Se a planilha continuar sendo editada, isso precisa ser decidido de novo.
4. **Tela inicial:** o mês corrente ou o extrato inteiro, pesquisável? No celular, a segunda opção pede
   lista virtualizada.
5. **Casos sujos conhecidos** (do perfil real dos dados): 433 valores com mais de 2 casas decimais, 3
   valores zero, 4 linhas com `SUBTOTAL` manual. Arredondar, recusar ou importar sinalizando?
6. **Tamanho e tempo:** 4.805 linhas numa importação só. Aceitável esperar? Importar em lotes com
   progresso? O driver HTTP do Neon não tem transação interativa, então a gravação precisa ser em
   lotes idempotentes, com `CÓD` como chave.

## 6. Direção de interface

Gerada com a skill `ui-ux-pro-max` e verificada contra o produto. O arquivo
`design-system/financecontrol/MASTER.md` é a fonte; `AJUSTES-DO-PROJETO.md` registra onde o projeto
diverge dele, e por quê.

- **Estilo: Minimalismo / Swiss.** Indicado para dashboards e ferramentas profissionais, com risco de
  acessibilidade baixo. Nada de vidro fosco ou gradiente: aqui o conteúdo é número, e número precisa
  de contraste.
- **Densidade alta** (escala de 8 a 32px): é tela de dados, não landing page.
- **Movimento discreto** (2/10): transições curtas, sempre respeitando `prefers-reduced-motion`.
- **Tipografia: IBM Plex Sans** (par "Financial Trust", descrito na base como excelente para dados),
  com `tabular-nums` em todo valor monetário, para os números alinharem em coluna.
- **Tema claro e escuro seguindo o sistema**, como a spec §8 exige. O `MASTER.md` traz a paleta
  escura; a clara precisa ser espelhada com o mesmo contraste.
- **Alvos de toque de 44×44px** com 8px de folga. Hoje os campos têm 32px de altura, apertado para o
  dedo — em especial os campos de data e de mês.
- **Tabela no celular vira cartão**; no computador, tabela com colunas. Nunca rolagem horizontal na
  página inteira.
- **Seleção múltipla com barra de ações** (já existe na lista do mês) é o padrão recomendado para ações
  em massa.
- **Importação com progresso explícito** ("Etapa 2 de 4"), porque é processo de vários passos.
- **Estados vazios que ensinam:** a tela sem dados convida a enviar a planilha, em vez de só dizer que
  está vazia.
- **Ícones em SVG** (`lucide-react`, já instalado), nunca emoji. A navegação atual usa `＋` como texto.

## 7. Critérios de aceite

1. Enviar a planilha real de 4.805 linhas e ver, **antes de gravar**, quantas linhas entram, quantas
   são repetidas e quantas têm problema.
2. Depois de confirmar, os totais do mês corrente no app batem com os da planilha.
3. Abrir o app e cair na visão dos lançamentos, sem passar por formulário.
4. Lançar manualmente continua possível em no máximo dois toques a partir da tela inicial.
5. Nenhum arquivo do dono fica guardado no servidor depois da importação.
6. Todas as telas passam no checklist de entrega do sistema de design: contraste, alvo de toque, foco
   visível, tema claro e escuro, movimento reduzido.
7. Nada de dado real versionado: `.xlsx`, `.csv` e `.pdf` seguem bloqueados no `.gitignore`.

## 8. Riscos

| Risco | Observação |
|---|---|
| Importação parcial deixando o banco no meio do caminho | Sem transação no driver HTTP: gravar em lotes idempotentes por `CÓD`, podendo reexecutar |
| Nomes iguais em formas Unicode diferentes | **Pré-requisito da importação:** normalizar em NFC antes de comparar; o índice único compara bytes |
| Planilha com estrutura diferente da referência | Validar o cabeçalho antes de ler e recusar com mensagem clara, em vez de importar errado |
| Arquivo grande no celular | Medir; se preciso, processar em fluxo no servidor e responder com progresso |
| Dono confiar num número errado | A tela de conferência é obrigatória; nunca gravar direto |
