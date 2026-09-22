# FinanceControl — Núcleo · Design

| | |
|---|---|
| **Data** | 2026-09-14 |
| **Status** | Aprovado. Arquitetura e dados aprovados em conversa; telas, erros, testes e ponte delegados ao Cérebro. |
| **Sub-projeto** | 1 de 3 — **Núcleo** → Migração da planilha → Importação da fatura PDF |
| **Referências** | [`planilha-gastos.md`](../../referencias/planilha-gastos.md) · [`fatura-santander.md`](../../referencias/fatura-santander.md) |

---

## 1. Contexto

O dono do sistema tem um cartão de crédito usado por várias pessoas. A aba **GASTOS** da planilha
`USO_CARTÃO.xlsx` registra cada lançamento que outra pessoa deve (4.805 linhas desde 2018, ~20 a 40 por mês)
e calcula quem deve quanto, o que já foi recebido e o que falta. O controle depende do Excel no computador,
e registrar algo na hora pelo celular (por exemplo, um PIX recebido no momento da compra) é difícil.

O PRD original (PWA escrevendo na planilha via Microsoft Graph) foi descartado: a API de Excel do Graph
**não funciona com OneDrive pessoal** (confirmado pela Microsoft em mar/2026).

## 2. Objetivo

Um site que **substitui a aba GASTOS** e vira a fonte da verdade.

**Regra do dono:** visualizar e manipular **melhor que no Excel**, cumprindo o mesmo objetivo: saber quem
deve quanto, cobrar e registrar o que foi recebido.

## 3. Decisões

| # | Decisão | Motivo |
|---|---|---|
| D1 | O site substitui só a aba GASTOS; o RESUMO vira a tela "Quem me deve" | foco no objetivo |
| D2 | Next.js 16 + TypeScript + Neon (Postgres) + Drizzle, hospedado na Vercel Hobby | fullstack leve, grátis, deploy por `git push` |
| D3 | Login único com credenciais em variáveis de ambiente | um usuário só; sem serviço externo de autenticação |
| D4 | Endereço `*.vercel.app`, sem domínio próprio | custo zero |
| D5 | Regras iguais às da planilha, com duas mudanças: **mês da fatura** no lugar do "dia 5" e **PERDOADO zera o RESTANTE** | evidência dos dados (§6.1) |
| D6 | O histórico será migrado da planilha atual | saldos corretos desde o primeiro dia |
| D7 | A fatura PDF será entrada automática de dados | fim da cópia manual da fatura |
| D8 | Sem modo offline na v1 | simplicidade; o site só avisa quando está sem internet |
| D9 | Repositório `FinanceControl` (GitHub privado), fora do OneDrive | a sincronização do OneDrive trava e corrompe `node_modules` e `.git` |
| D10 | Entrega do Núcleo em dois planos (§15) | colocar no ar cedo e escrever o segundo plano sobre o código real |

## 4. Escopo

### 4.1 Dentro do Núcleo
- Login, sessão de 30 dias e bloqueio após tentativas erradas.
- Lançar, editar e excluir lançamentos; criar pessoas e categorias sem sair do formulário.
- Tela **Quem me deve** (saldo por pessoa) e **extrato por pessoa** com "copiar cobrança".
- Tela **Lançamentos** por mês da fatura, com filtros, totais e ações em massa (marcar recebido, perdoar, excluir).
- **Preparar próximo mês:** gerar as parcelas que continuam e os gastos recorrentes.
- **Cadastros:** renomear, desativar e reativar pessoas e categorias.
- **Exportar CSV** do que está filtrado.
- Instalável na tela inicial do celular (PWA sem modo offline).
- Deploy na Vercel com banco Neon.

### 4.2 Em outros sub-projetos
- **Sub-projeto 2 — Migração:** importar as 4.805 linhas da planilha.
- **Sub-projeto 3 — Importação da fatura PDF.**

### 4.3 Fora da v1
Vários usuários ou acesso da família · notificações · modo offline · as outras abas da planilha
(RESUMO como planilha, CONTAS DO MÊS, BASE, CÁLCULOS, RASCUNHO) · domínio próprio.

---

## 5. Arquitetura

```
Celular / PC (navegador)
        │ HTTPS
        ▼
Vercel ─ Next.js "FinanceControl"
        ├─ proxy.ts (porteiro): sem sessão válida → /login
        ├─ Páginas (React Server Components)   → mostram os dados
        ├─ Server Actions / Route Handlers     → gravam e exportam
        └─ src/domain                          → regras da planilha
        ▼
Neon (Postgres) ─ pessoas · categorias · lancamentos · tentativas_login
```

### 5.1 Pastas

| Pasta | Responsabilidade | Depende de |
|---|---|---|
| `src/domain/` | regras puras: dinheiro, mês da fatura, subtotal, situação, restante, resumo, cobrança, próximas parcelas | nada |
| `src/db/` | schema Drizzle, cliente do banco e consultas | `domain` (tipos) |
| `src/auth/` | hash de senha, token de sessão, bloqueio de tentativas | `db` |
| `src/app/` | páginas, Server Actions e Route Handlers (finos: sessão → validação Zod → `db`/`domain`) | tudo acima |
| `src/components/` | componentes de interface (shadcn/ui) | — |
| `scripts/` | utilitários de linha de comando (hash da senha; migração no sub-projeto 2) | `domain`, `db` |
| `tests/` | apoio de testes (banco PGlite em memória) | `db` |

### 5.2 Ambientes

| Ambiente | Onde | Banco |
|---|---|---|
| Produção | branch `main` → Vercel | Neon, branch `main` |
| Desenvolvimento | `npm run dev` no PC | Neon, branch `dev` (via `.env.local`) |
| Testes | `npm test` (local e CI) | PGlite em memória, sem internet |

### 5.3 Variáveis de ambiente

Validadas com Zod ao iniciar: se faltar alguma, o app falha logo, com mensagem clara.

| Nome | Conteúdo |
|---|---|
| `DATABASE_URL` | conexão Neon: branch `dev` no `.env.local`, branch `main` nas variáveis de produção da Vercel |
| `AUTH_USUARIO` | nome de usuário do dono |
| `AUTH_SENHA_HASH` | hash scrypt da senha, gerado por `npm run credenciais` |
| `AUTH_SEGREDO` | chave aleatória com ≥ 32 caracteres que assina o cookie de sessão |

### 5.4 Bibliotecas

Next.js 16 · React 19 · TypeScript · Tailwind CSS 4 · shadcn/ui · Drizzle ORM + drizzle-kit ·
`@neondatabase/serverless` (produção) · `@electric-sql/pglite` (testes) · Zod 4 · jose (token de sessão) ·
Vitest. O hash de senha usa o `crypto.scrypt` nativo do Node, sem biblioteca extra.

---

## 6. Modelo de dados

### 6.1 O que os dados reais mostraram (e o que mudou)

| Achado na planilha | Decisão |
|---|---|
| VENCIMENTO é **sempre dia 5** | guardar o **mês da fatura** (data no dia 1) |
| Cada parcela é uma linha por mês (1.387 de 1.392 pares seguidos) | 1 linha = 1 parcela |
| `∞` em 605 linhas | campo `recorrente` |
| 433 valores com mais de 2 casas decimais | dinheiro em centavos inteiros |
| 393 valores negativos | créditos suportados (A ABATER / ABATIDO) |
| PAGO? só `SIM` ou vazio; nunca PERDOADO | vazio → `NAO`; PERDOADO continua disponível |
| SUBTOTAL digitado à mão em 4 linhas | SUBTOTAL sempre recalculado |

### 6.2 Tabelas

**`pessoas`** e **`categorias`** (mesma forma)

| Coluna | Tipo | Regra |
|---|---|---|
| `id` | integer identity | chave primária |
| `nome` | text | obrigatório, único (comparação sem diferenciar maiúsculas) |
| `ativo` | boolean | padrão `true`; inativo some das listas de escolha, mas continua no histórico |
| `criado_em` | timestamptz | padrão `now()` |

**`lancamentos`**

| Coluna | Tipo | Na planilha | Regra |
|---|---|---|---|
| `id` | integer identity (by default) | CÓD | mantém 1–4805 na migração; novos seguem a sequência. **Substituído pela decisão D12** (spec [`2026-09-16-planilha-primeiro-design.md`](2026-09-16-planilha-primeiro-design.md), §3.1): o `CÓD` não vai para `id` — vira `cod_planilha`, coluna separada e anulável |
| `mes_fatura` | date | VENCIMENTO | obrigatório; `CHECK` dia = 1 |
| `data_compra` | date | — | opcional |
| `pessoa_id` | integer → `pessoas` | ORIGEM | obrigatório; `ON DELETE RESTRICT` |
| `categoria_id` | integer → `categorias` | CATEGORIA | obrigatório; `ON DELETE RESTRICT` |
| `item` | text | ITEM | obrigatório, não vazio |
| `valor_centavos` | integer | VALOR | obrigatório; negativo = crédito |
| `parcela_atual` | smallint | PARCELA ATUAL | padrão 1; `CHECK ≥ 1` |
| `qtd_parcelas` | smallint | QTD PARCELAS | `NULL` se recorrente |
| `recorrente` | boolean | QTD = `∞` | padrão `false` |
| `pagamento` | enum `pagamento` (`NAO`, `SIM`, `PERDOADO`) | PAGO? | padrão `NAO` |
| `pago_em` | date | — | preenchido ao marcar `SIM` |
| `fonte` | enum `fonte` (`manual`, `planilha`, `fatura`, `virada`) | — | padrão `manual` |
| `criado_em` / `atualizado_em` | timestamptz | — | padrão `now()` |

Restrições extras:
- `CHECK ((recorrente AND qtd_parcelas IS NULL) OR (NOT recorrente AND qtd_parcelas IS NOT NULL AND qtd_parcelas >= parcela_atual))`
- `CHECK (pago_em IS NULL OR pagamento = 'SIM')`
- Índices: `(mes_fatura)` e `(pessoa_id, pagamento)`.

**`tentativas_login`**: `id` identity · `ip` text · `criado_em` timestamptz (padrão `now()`) · índice `(ip, criado_em)`.

---

## 7. Regras de negócio

Todas em `src/domain`, como funções puras (sem banco, sem relógio, sem tela). "Hoje" chega como parâmetro.

**R0 — Hoje e fuso.** "Hoje" é a data no fuso `America/Sao_Paulo`. O servidor da Vercel roda em UTC: às 22h de
30/09 em São Paulo já é 01/10 em UTC, o que mudaria o mês do RESTANTE e da sugestão de fatura.

**R1 — Dinheiro.** Valores em centavos inteiros. `"1.234,56"` → `123456`; `123456` → `"R$ 1.234,56"`.
Entrada aceita `1234,56`, `1.234,56` e `1234`. A formatação usa `Intl.NumberFormat('pt-BR', { currency: 'BRL' })`.

**R2 — Mês da fatura.** Sempre `AAAA-MM-01`. Exibição: `set/2026`.

**R3 — Sugestão de mês da fatura.** Com `DIA_FECHAMENTO = 9`:
- dia da compra ≤ 9 → fatura do mês da compra;
- dia da compra > 9 → fatura do mês seguinte (dezembro vira janeiro do ano seguinte).

Conferência com a fatura real: compras de 11/08 a 09/09 caem em set/2026.

**R4 — Subtotal.** `recorrente ? valor : qtd_parcelas × valor`.

**R5 — Situação.**
| `pagamento` | `valor < 0` | Situação |
|---|---|---|
| `PERDOADO` | qualquer | PERDOADO |
| `SIM` | sim | ABATIDO |
| `NAO` | sim | A ABATER |
| `SIM` | não | RECEBIDO |
| `NAO` | não | A RECEBER |

**R6 — Restante** (depende de hoje).
- `0` se `pagamento` ≠ `NAO` ou se `recorrente`.
- Senão, se o mês da fatura é o mês de hoje: `(qtd_parcelas − parcela_atual) × valor`.
- Senão, `0`.

(Na planilha, PERDOADO não zerava o RESTANTE. Mudança deliberada: o que foi perdoado não pode inflar o "quanto falta".)

**R7 — Resumo por pessoa** (tela Quem me deve), considerando só lançamentos com `pagamento = NAO`:
- `aReceber` = soma dos valores em A RECEBER;
- `aAbater` = soma dos valores em A ABATER (número negativo);
- `saldo` = `aReceber + aAbater`;
- `restante` = soma do R6 com a data de hoje;
- `itensEmAberto` = quantidade.

Aparecem as pessoas com `saldo ≠ 0` ou `restante ≠ 0`, ordenadas por saldo decrescente.

**R8 — Texto de cobrança** (botão "Copiar cobrança"). Só itens em aberto da pessoa, agrupados por mês da fatura crescente:

```
Resumo do cartão — {Pessoa}

Fatura set/2026
• {item} ({parcela_atual}/{qtd_parcelas}) — R$ 123,45
• {item} (mensal) — R$ 39,90
• {item} (crédito) — -R$ 10,00

Total: R$ 153,35
```

Parcela aparece só quando `qtd_parcelas > 1`; recorrente mostra `(mensal)`; valor negativo mostra `(crédito)`.

**R9 — Próximas parcelas** (Preparar próximo mês). A partir dos lançamentos do mês M, gerar candidatos para M+1:
- não recorrente com `parcela_atual < qtd_parcelas` e `pagamento ≠ PERDOADO` → mesma pessoa, categoria, item e valor, com `parcela_atual + 1`;
- recorrente com `pagamento ≠ PERDOADO` → mesmos dados, com `parcela_atual` igual;
- todos com `pagamento = NAO`, `pago_em = NULL`, `data_compra` igual à original, `fonte = virada`;
- **não gerar** se M+1 já tem lançamento com mesma pessoa, categoria, item (sem diferenciar maiúsculas, sem espaços nas pontas), valor, `qtd_parcelas`, `parcela_atual` e `recorrente`.

---

## 8. Telas e fluxos

Navegação: barra inferior no celular e barra lateral no computador, com **Início · Lançamentos · ＋ Lançar · Cadastros**.
Visual shadcn/ui, tema claro/escuro seguindo o sistema, valores alinhados à direita com algarismos tabulares.
Situação sempre como **chip com texto e cor** (nunca só cor):
A RECEBER (âmbar) · RECEBIDO (verde) · A ABATER (azul) · ABATIDO (cinza) · PERDOADO (roxo).

| Rota | Tela | O que faz |
|---|---|---|
| `/login` | Login | usuário e senha; erro genérico "Usuário ou senha incorretos"; mensagem de bloqueio com minutos restantes; volta para a página pedida (`?voltar=`) |
| `/` | **Quem me deve** | total geral em aberto (saldo) no topo; um card por pessoa do R7 com saldo, A RECEBER, A ABATER, restante e nº de itens; toque abre o extrato; atalho "＋ Lançar" |
| `/pessoas/[id]` | **Extrato da pessoa** | itens em aberto agrupados por mês com caixas de seleção; ações **Marcar como recebido** (`SIM`, `pago_em` = hoje) e **Perdoar**; botão **Copiar cobrança** (R8) com aviso "Copiado"; histórico dos últimos recebidos, com "ver mais" |
| `/lancamentos` | **Lançamentos** | mês da fatura com setas ‹ › (padrão: mês de hoje); filtros de pessoa, categoria, situação e busca por item, **guardados na URL**; totais do filtro (soma, A RECEBER, A ABATER); tabela no computador e cards no celular; seleção múltipla para marcar recebido, perdoar ou excluir; botões **Preparar próximo mês** e **Exportar CSV** |
| `/lancamentos/novo` | **Lançar** | formulário da §8.1 |
| `/lancamentos/[id]` | **Editar** | mesmo formulário, preenchido; botão Excluir com confirmação |
| `/lancamentos/preparar?de=AAAA-MM` | **Preparar próximo mês** | lista os candidatos do R9 já marcados; dá para desmarcar; "Criar N lançamentos" |
| `/cadastros` | **Cadastros** | abas Pessoas e Categorias: criar, renomear, desativar/reativar; nome duplicado mostra erro |
| `/lancamentos/exportar?…` | CSV | Route Handler com os mesmos filtros da tela |

### 8.1 Formulário de lançamento (mobile first)

| Campo | Comportamento |
|---|---|
| Pessoa | obrigatória; lista com busca; "＋ Criar '{texto}'" quando não existe |
| Valor | obrigatório, ≠ 0; teclado decimal (`inputMode="decimal"`); aceita `1.234,56` |
| É crédito? | interruptor que grava o valor negativo. Motivo: o teclado decimal do iPhone **não tem sinal de menos** |
| Item | obrigatório |
| Categoria | obrigatória; lista com busca e "＋ Criar" |
| Data da compra | padrão: hoje (R0) |
| Mês da fatura | sugerido pelo R3 a partir da data da compra; editável |
| Parcela | "Parcela [1] de [1]"; interruptor **Recorrente (mensal)** esconde a quantidade |
| Já recebi | interruptor; ligado grava `SIM` e `pago_em` = hoje |
| Botões | **Salvar** e **Salvar e lançar outro** (mantém pessoa, data da compra e mês da fatura) |

### 8.2 CSV exportado
- Separador `;`, decimal com vírgula e BOM UTF-8, para abrir certo no Excel em português.
- Colunas: `CÓD;MÊS DA FATURA;PESSOA;CATEGORIA;ITEM;PARCELA;QTD PARCELAS;VALOR;SUBTOTAL;RESTANTE;PAGO?;SITUAÇÃO;RECEBIDO EM`.
- `QTD PARCELAS` recorrente sai como `∞`; `PAGO?` sai `SIM`, `NÃO` ou `PERDOADO`.

---

## 9. Erros e casos-limite

| Situação | Comportamento |
|---|---|
| Campo inválido | mensagem ao lado do campo, em português; o formulário mantém o que foi digitado |
| Duplo clique em Salvar | botão desabilitado enquanto envia |
| Sem internet | faixa "Sem internet — nada será salvo até a conexão voltar" |
| Sessão expirada | redireciona para `/login?voltar=<rota>` |
| Erro inesperado no servidor | aviso "Não foi possível salvar. Tente de novo."; detalhe só no log do servidor |
| Excluir pessoa/categoria em uso | não existe: só desativar (o banco também impede com `RESTRICT`) |
| Nome duplicado em cadastro | "Já existe uma pessoa com esse nome" |
| Parcela maior que a quantidade | erro no formulário e `CHECK` no banco |
| Valor 0 no formulário | recusado (a migração pode trazer os 3 zeros históricos) |
| Dois dispositivos editando | vale a última gravação (um usuário só; risco aceito) |

---

## 10. Segurança e privacidade

- **Senha:** hash `scrypt` (Node `crypto`) com sal aleatório; comparação com `timingSafeEqual`.
  Formato `scrypt:N:r:p:salBase64url:hashBase64url`. **Sem `$`**: o carregador de `.env` do Next expande `$NOME` como variável e estragaria o hash.
- **Sessão:** JWT HS256 assinado com `AUTH_SEGREDO` (biblioteca `jose`), no cookie `fc_sessao` com `HttpOnly`, `Secure` em produção, `SameSite=Lax`, `Path=/` e validade de 30 dias.
- **Porteiro:** `proxy.ts` redireciona quem não tem sessão válida. Além disso, **toda Server Action e todo Route Handler protegido chama `exigirSessao()`**: actions viram endpoints POST que podem ser chamados diretamente, sem passar pela página.
- **Bloqueio:** 5 falhas do mesmo IP em 15 minutos bloqueiam novas tentativas até a janela passar; login certo limpa as falhas daquele IP.
- **CSRF:** Server Actions do Next comparam `Origin` e `Host`; o cookie `SameSite=Lax` reforça.
- **Cabeçalhos:** `X-Frame-Options: DENY`, `Referrer-Policy: same-origin`, `X-Content-Type-Options: nosniff`.
- **Privacidade:** repositório privado; `.gitignore` bloqueia `.env*`, `*.xlsx`, `*.csv` e `*.pdf`; fixtures sempre fictícias; o CSV exportado é gerado na hora e não fica salvo no servidor.
- **Backup:** restauração do Neon (janela do plano grátis) + Exportar CSV + a planilha original intocada.

---

## 11. Testes e verificação

| Nível | Ferramenta | Cobre |
|---|---|---|
| Unidade (TDD) | Vitest | R0 a R9: centavos, fuso e virada de ano, sugestão de fatura, subtotal, as 5 situações, restante (mês atual ou não, pago, perdoado, recorrente), resumo, texto de cobrança, próximas parcelas e deduplicação; hash de senha; token de sessão; validação das variáveis de ambiente |
| Integração | Vitest + PGlite | migrações aplicadas do zero; restrições do banco (parcela > qtd, recorrente com qtd, `pago_em` sem SIM, dia ≠ 1); consultas de cadastros e lançamentos; marcar vários como recebidos; bloqueio de login |
| CI | GitHub Actions | `npm ci`, `lint`, `typecheck` e `test` a cada push e pull request |
| Manual | checklist | login no celular, lançar, ver no mês, marcar recebido, instalar na tela inicial |

Server Actions ficam finas; a lógica que importa é testada em `domain`, `db` e `auth`.

---

## 12. Ponte com os próximos sub-projetos

**Sub-projeto 2 — Migração da planilha**
- Script `scripts/migrar-planilha.ts`, rodado localmente, lendo o `.xlsx` fora do repositório.
- Mapeamento: VENCIMENTO → `mes_fatura` (dia 1) · `∞` → `recorrente` · vazio → `NAO` · VALOR arredondado para centavos · CÓD → `id` (depois ajustar a sequência de identidade) · `fonte = planilha`.
  **Substituído pela decisão D12** (spec [`2026-09-16-planilha-primeiro-design.md`](2026-09-16-planilha-primeiro-design.md), §3.1): `CÓD` não vai para `id` — vira `cod_planilha`, coluna separada e anulável; sem sequência de identidade para ajustar.
- Relatório de conferência: valores arredondados, as 4 linhas com SUBTOTAL manual, SITUAÇÃO recalculada × cache, possíveis `parcela_atual = 0` em recorrentes.
- O Núcleo já deixa pronto: `id` aceitando valor explícito, `fonte` e as funções de `domain`.

**Sub-projeto 3 — Importação da fatura PDF**
- Upload → leitor puro e testado (regras de conferência de [`fatura-santander.md`](../../referencias/fatura-santander.md)) → tela de revisão (padrão: ignorar; sugestão de pessoa pelo cartão; duplicidade contando ocorrências; casar com linhas `fonte = virada` já criadas) → gravação com `fonte = fatura` e `data_compra`.
- O tratamento da senha do PDF será decidido lá.
- O Núcleo já deixa pronto: `data_compra`, `fonte` e o R9.

---

## 13. Critérios de aceite do Núcleo

1. Sem sessão, toda página redireciona para `/login` e toda action ou exportação é recusada.
2. Depois de 5 senhas erradas em 15 minutos do mesmo IP, o login fica bloqueado até a janela passar.
3. Pelo celular, dá para lançar com teclado decimal e mês da fatura sugerido; o lançamento aparece na hora no mês e na Início.
4. R0 a R9 cobertas por testes de unidade, inclusive virada de ano e fuso horário.
5. Marcar vários itens como recebidos é uma única ação e preenche `pago_em`.
6. "Copiar cobrança" gera exatamente o texto do R8.
7. Filtros ficam na URL e os totais batem com a soma das linhas filtradas.
8. "Preparar próximo mês" não duplica lançamentos já existentes.
9. O CSV abre no Excel em português com acentos e valores corretos.
10. CI verde; produção funcionando na Vercel e instalável na tela inicial do iPhone.

---

## 14. Riscos e pontos de atenção

| Risco | Mitigação |
|---|---|
| Versões novas com mudanças de API (Next 16.3, Vitest 5, Zod 4, TypeScript 7, ESLint 10) | usar a versão que o `create-next-app@16.3.5` instalar; conferir a documentação ao estranhar erro; o plano indica os pontos sensíveis |
| Limites do plano grátis (Neon compute, Vercel Hobby) | volume minúsculo (~40 linhas/mês); Hobby exige uso pessoal e não comercial, que é o caso |
| iPhone pedindo login com mais frequência no app instalado | sessão em cookie `HttpOnly` de 30 dias; login é rápido |
| Fuso horário | R0 centralizado e testado |
| Driver Neon HTTP sem transações interativas | operações em lote com um único `INSERT`/`UPDATE` |

---

## 15. Entrega em dois planos

| Plano | Nome | Conteúdo | Resultado |
|---|---|---|---|
| **1** | Primeiro lançamento no ar | fundação (projeto, testes, CI, variáveis); domínio R0–R6; banco (schema, migrações, testes PGlite, consultas de cadastros e lançamentos); autenticação (senha, sessão, bloqueio, porteiro, login); telas mínimas (Lançar e lista do mês com "marcar recebido"); README; deploy | o dono já lança pelo celular em produção |
| **2** | Melhor que o Excel | R7–R9; Quem me deve; extrato com cobrança; Lançamentos completo (filtros na URL, edição, exclusão, ações em massa); Preparar próximo mês; Cadastros; CSV; PWA | Núcleo completo (§13) |

O Plano 2 é escrito pelo Cérebro quando o Plano 1 terminar, a partir do código real.
