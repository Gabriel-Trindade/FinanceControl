# Pendências deixadas pelo Plano 1

Tudo aqui foi **encontrado por uma revisão** durante a execução do Plano 1 e adiado de propósito: nada
impede o app de funcionar hoje. A revisão final do branch triou item a item; esta é a lista que sobrou
para o Plano 2. Fonte: revisões de tarefa e revisão final do branch `nucleo-plano-1` (PR #1).

## 1. Pré-requisito da importação da planilha

- **Normalizar nomes em NFC.** `normalizarNome` (`src/db/cadastros.ts`) não normaliza a forma Unicode, e
  `compararNomes` considera iguais duas formas diferentes de "José". O índice único do banco compara
  bytes, então as duas formas viram **duas pessoas**. Hoje o risco é baixo, porque o teclado do iPhone
  produz NFC — mas 4.805 nomes vindos do Excel podem chegar decompostos. **Resolver antes de importar.**

## 2. Base a fazer antes das telas novas

- **`error.tsx` e `global-error.tsx`.** Não existem. Se o banco cair, o dono vê a tela de erro padrão do
  Next, em inglês, em vez de uma mensagem em português.
- **Limpeza de `tentativas_login`.** A tabela só perde linhas quando o mesmo IP acerta o login; falhas de
  IPs que nunca entram ficam para sempre. Apagar o que está fora da janela dentro de `registrarFalha`.
- **`config.matcher` do proxy sem teste.** O teste novo (`src/proxy.test.ts`) chama a função direto: se o
  `matcher` sumisse, os três casos continuariam verdes com o app inteiro aberto.

## 3. Cobertura de testes que vale reforçar

- `calcularRestante` com **mês futuro** (hoje só testa meses passados; trocar `===` por `>=` passaria).
- `ehDataValida` com `2026-02-29` (29 de fevereiro em ano não bissexto).
- Banco: FK de categoria, `categorias_nome_unico`, `*_nome_preenchido`, e o caso aceito de
  `pagamento: 'SIM'` sem `pagoEm` (é assim que as linhas da planilha chegam). Afirmar o **nome da
  restrição** (`cause.constraint`) em vez de `.rejects.toThrow()` genérico.
- Consultas: corrida do `obterOuCriar`, `fonte: 'manual'` travado, filtro de inativos em categorias,
  troca de `pessoaId`/`categoriaId`, `PERDOADO` intacto ao marcar recebidos, desempate por `id`.
- Autenticação: `limparFalhas` preservando outros IPs, 5ª falha mais recente vs. mais antiga, checagem de
  tamanho e `catch` de `verificarSenha`, borda exata dos 30 dias, recusa de HS512.
- Validação: hash real de `gerarHashSenha` no `env.test.ts`, tentativa bloqueada não gravando linha, caso
  do caractere DEL, mensagem específica do teto do valor, `x-real-ip` acima de `x-forwarded-for`.
- `descreverParcela` com `2/2` e com `qtdParcelas: null`.

## 4. Robustez de entrada nas regras puras

Nenhum desses valores tem caminho de entrada hoje, porque tudo passa antes por `lerMes` ou pela validação
do formulário. É dívida real, mas inalcançável no estado atual:

- `formatarReais(-0)` devolve `"-R$ 0,00"` (resolve com `signDisplay: 'negative'`).
- `paraCentavos` remove `R$` e espaços em qualquer posição: `'12 3'` vira `12300`.
- `separar` (em `datas.ts`) aceita mês `00` e `13`, e aí `formatarMesFatura('2026-13-01')` devolve
  `'undefined/2026'`.

## 5. Configuração e empacotamento

- `package.json` com `"name": "app"`, herdado da pasta temporária do scaffold.
- `@next/env` é usado por `drizzle.config.ts` sem estar declarado (funciona por hoisting do npm).
- `engines.node` não declarado, embora README, CI e `@types/node` assumam Node 24.
- CI não roda `npm run build`: uma quebra de build só aparece no deploy.
- `lucide-react` instalado e ainda sem uso (vai ser usado no Plano 2, para trocar o `＋` de texto por ícone).
- `shadcn` está em `dependencies` de propósito: `globals.css` faz `@import "shadcn/tailwind.css"`, então
  mover para `devDependencies` quebraria `npm ci --omit=dev`.

## 6. Decisões que dependem de telas que ainda não existem

- `Db` expõe `transaction()`, que o driver HTTP do Neon não suporta: o PGlite dos testes aceitaria e a
  produção quebraria. Avaliar `Omit<..., 'transaction'>`.
- `obterOuCriar*` reaproveita cadastro inativo sem reativar: no fluxo "＋ Criar", a pessoa receberia
  lançamentos e continuaria fora das listas de escolha.
- A regra "token válido **e** usuário igual ao do `.env`" está escrita em dois lugares (`proxy.ts` e
  `sessao.ts`). Se só uma mudar, dá laço de redirecionamento.
- O `matcher` do proxy deixa passar caminhos que começam com `login` e que terminam em `.<letras>` — hoje
  coberto pelo `exigirSessao()` de layout e páginas, mas relevante quando existir rota `[id]`.
- `exigirSessao()` redireciona para `/login` sem `?voltar=`, enquanto a spec §9 pede o destino de volta.

## 7. Interface e vocabulário (entram junto com o trabalho de UI/UX)

- Campos com erro sem `aria-invalid`/`aria-describedby` (o `Input` do shadcn já pinta a borda com isso).
- Campo numérico apagado envia `''`, que vira `0` e mostra "No mínimo 1" em vez de "Informe a quantidade".
- POST direto com tipo errado recebe mensagem padrão do Zod, em inglês.
- Botão diz "recebidos" mesmo quando a seleção tem crédito, que vira ABATIDO.
- Mensagem única cobrindo "selecione ao menos um" e o limite de 500 ids.
- `alterados` é devolvido pela action e nunca mostrado ("2 de 3 marcados").
- `aria-label` da caixa de seleção repete quando duas pessoas têm o mesmo item.
- Login limpa o usuário digitado depois de um erro (React 19 reseta o formulário).
- Campos com 32px de altura: abaixo dos 44px recomendados para toque.

## 8. Conferir na Tarefa 11 (produção)

- **Região:** o banco Neon ficou em **Ohio** (`us-east-2`), porque N. Virginia não estava disponível. Em
  **Settings → Functions** da Vercel, usar `cle1` (Cleveland) deixa servidor e banco no mesmo estado.
- **`sslmode`:** o driver `pg` avisa que `require` hoje se comporta como `verify-full`, mas vai afrouxar
  em versões futuras. Usar `sslmode=verify-full` explicitamente nas variáveis de produção.
- **`x-forwarded-for`:** confirmar com uma requisição real se a Vercel sobrescreve o cabeçalho. O código
  já prefere `x-vercel-forwarded-for` e `x-real-ip`, que a plataforma controla.
- Declarar `engines.node` e `@next/env` no mesmo commit de ajuste.
