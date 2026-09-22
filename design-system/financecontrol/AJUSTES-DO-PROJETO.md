# Ajustes do projeto ao MASTER.md

O `MASTER.md` ao lado foi **gerado** pela skill `ui-ux-pro-max` (busca `financial dashboard data dense
mobile app`, com variance 3, motion 2 e density 8). Ele é a base. Este arquivo registra onde o
FinanceControl decide diferente, e por quê — leia os dois juntos.

## 1. Tipografia: use IBM Plex Sans, não o par Fira

O `MASTER.md` sugere `Fira Code` para títulos e `Fira Sans` para texto. Fonte de código em título não
combina com um app de finanças pessoais, e duas famílias custam mais carregamento no celular.

**Decisão:** família única **IBM Plex Sans**, que veio da busca `tabular numbers financial data`
(par "Financial Trust", descrito na base como "Excellent for data", indicado para bancos e fintech).

- Todo valor monetário usa `tabular-nums`, para os dígitos ocuparem a mesma largura e as colunas
  alinharem.
- Alternativa aceitável, se o objetivo for zero fonte extra: manter a **Geist**, que o template do Next
  já carrega, e garantir o `tabular-nums`. Decidir no brainstorming do Plano 2.

## 2. O "Pattern" do MASTER não se aplica

O `MASTER.md` traz o padrão **Enterprise Gateway**, com hero, logos de clientes e "Contact Sales". Isso
é estrutura de **landing page**. O FinanceControl é um app atrás de login, de um usuário só, sem página
de vendas.

**Decisão:** ignorar a seção *Page Pattern*. A navegação segue padrão de aplicativo: barra inferior no
celular com até 5 itens, barra lateral no computador, botão voltar previsível e links que podem ser
salvos (o mês fica na URL).

## 3. Tema claro também é obrigatório

A paleta do `MASTER.md` é escura (fundo `#020617`). A spec §8 exige **tema claro e escuro seguindo o
sistema**, e o app já funciona assim via `prefers-color-scheme`.

**Decisão:** a paleta escura do MASTER serve de referência para os tokens escuros; a clara precisa ser
espelhada com o mesmo contraste (mínimo 4.5:1 para texto). Onde o MASTER lista `#RRGGBB`, o projeto usa
os tokens que o shadcn já criou em `src/app/globals.css` (formato `oklch`) — mapeie por **papel**
(`--background`, `--card`, `--primary`, `--destructive`…), não copiando hex.

**Decisão do projeto, não do MASTER:** no tema claro, a superfície devia ser um branco levemente
quebrado, não branco puro. Versões anteriores deste arquivo diziam que "o MASTER proíbe fundo branco
puro" — **isso é falso**. O `MASTER.md` não tem essa regra em lugar nenhum; os anti-patterns dele são
só "Light mode default" e "Slow rendering", e ele próprio usa `background: white` no modal
(`MASTER.md:157`) e `color: white` no botão primário (`:86`). A preferência é do projeto, e quem
quiser reabri-la só precisa convencer o dono.

**O estado de hoje é branco puro** (`--background: oklch(1 0 0)`, herdado do `create-next-app`), e
mudar isso **não é ajuste de uma linha**:

- `--background`, `--card` e `--popover` são o mesmo branco: mexer num mexe nas três, e em toda tela.
- Todo o orçamento de contraste dos tokens de `globals.css` foi calibrado contra branco puro, e a
  folga é pequena. Medido: `--chart-2` dá 4.76:1 hoje, 4.56:1 com `oklch(0.985)` e **reprova**
  (4.48:1) já em `oklch(0.98)`.

Ou seja: **quem trocar o fundo refaz obrigatoriamente a tabela de contraste inteira do `globals.css`.**
Isso precisa estar escrito na descrição da tarefa que fizer a troca, não num comentário. E vale fazer
cedo: cada tela nova calibrada contra branco puro aumenta o retrabalho.

## 4. Sombra pesa pouco, borda pesa menos

A tabela de sombras do MASTER é pensada para tema claro. No escuro, sombra quase não aparece e pesa em
telas OLED.

**Decisão:** separar superfícies com **borda de 1px** e variação de luminosidade; sombra só em elemento
flutuante de verdade (modal, menu).

## 5. O que fica valendo do MASTER, sem mudança

- Estilo **Minimalismo / Swiss**: limpo, tipografia forte, grade, alto contraste.
- **Densidade 8/10** (escala de 8 a 32px): é tela de dados.
- **Movimento sutil** (2/10), sempre com `prefers-reduced-motion` respeitado.
- A seção **Component Specs** (botões, cartões, campos, modais) como ponto de partida, com uma ressalva:
  os alvos de toque precisam de **44×44px** no celular. Os campos hoje têm 32px de altura.
- O **Pre-Delivery Checklist** do fim do arquivo, junto com `references/pro-rules.md` da própria skill.

## 6. Como regerar

O `--persist` **não sobrescreve** um `MASTER.md` existente; só com `--force`, e isso precisa de
autorização explícita do dono, porque apaga decisões anteriores. Para uma tela específica, o caminho é
criar um arquivo em `design-system/financecontrol/pages/<tela>.md`, que tem prioridade sobre o MASTER.
