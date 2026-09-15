# Referência: fatura PDF (Santander Unlimited Mastercard)

> Documento **sem dados pessoais**. Faturas reais nunca entram no repositório.
> Base para o sub-projeto 3 (importação da fatura). Analisada em 2026-09-14 (fatura com 5 páginas).

## Acesso ao arquivo
- O PDF original do banco é **protegido por senha**.
- Uma cópia gerada no Edge ("Imprimir → Salvar como PDF") abre sem senha e mantém o texto.
- A decisão de como o site lida com a senha fica para o sub-projeto 3.

## Estrutura
- **Página 1:** resumo (total a pagar, vencimento, "compras e pagamentos realizados até DD/MM", histórico de faturas).
- **Páginas 2 a 4:** "Detalhamento da Fatura".
- **Página 5:** texto legal (juros, CET, canais de atendimento).

### Detalhamento
- Lançamentos **agrupados por cartão**. Cabeçalho do grupo: `NOME - NNNN XXXX XXXX 1234`. Um `@` antes do nome indica cartão virtual.
- Cada cartão tem até três seções:
  - **Pagamento e Demais Créditos:** valores negativos (pagamento da fatura anterior, estornos, créditos).
  - **Parcelamentos:** compras parceladas, com a coluna Parcela no formato `NN/MM`.
  - **Despesas:** compras à vista (mas podem ter parcela, ex.: anuidade `02/12`).
- Colunas: `Compra` (ícone) · `Data` (`DD/MM`, **sem ano**) · `Descrição` · `Parcela` · `R$` · `US$`.
- Valores no formato brasileiro (`1.234,56`, negativo com `-`).
- Layout em **duas colunas** por página: um cartão ou seção continua na coluna da direita ou na próxima página **sem repetir o cabeçalho**.

## Regras de conferência (verificadas manualmente)
1. Parcelamentos + Despesas de um cartão = o "VALOR TOTAL" desse cartão.
2. Soma dos "VALOR TOTAL" = "(+) Total Despesas/Débitos no Brasil".
3. Soma dos valores negativos, exceto o débito automático = "(-) Total de créditos".
4. A linha `DEB AUTOM DE FATURA` = "(-) Total de pagamentos". Ela é o pagamento da fatura anterior: **não é gasto de ninguém**.
5. Saldo anterior + despesas − pagamentos − créditos = "(=) Saldo Desta Fatura".

## Armadilhas para o importador
- **Linhas idênticas legítimas** no mesmo dia (mesma descrição e valor). A detecção de duplicidade precisa contar ocorrências.
- **Estorno de parcelado:** todas as parcelas aparecem de uma vez, mais um crédito negativo igual à soma delas.
- **Data sem ano:** uma compra `DD/MM` na parcela `10/10` é do ano anterior. A referência é o mês da fatura.
- **Cartão não garante a pessoa:** assinaturas de pessoas diferentes podem estar no mesmo cartão.
- A planilha registra só parte das ~150 linhas da fatura; o padrão da importação deve ser **ignorar**, com escolha do que entra.
