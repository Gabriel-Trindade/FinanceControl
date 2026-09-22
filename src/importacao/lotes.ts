// Tamanho do lote de gravação. Mora aqui (não em src/db/importacao.ts) porque a tela
// de importação (componente de cliente) também precisa dele para fatiar os
// lançamentos antes de mandar cada lote numa Server Action — importar de
// src/db/importacao.ts arrastaria drizzle-orm e o schema inteiro para o navegador.
//
// Por quê 500: o INSERT grava 13-14 colunas por linha, e o Postgres aceita 65.535
// parâmetros por consulta (teto de ~5.041 linhas). 500 dá ~6.500-7.000 parâmetros —
// folga larga — e cerca de dez passos de progresso para as 4.805 linhas da planilha.
export const TAMANHO_DO_LOTE = 500
