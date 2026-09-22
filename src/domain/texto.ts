// O banco (PGlite com collation "C", Neon com "C.UTF-8") ordena pelo código do caractere,
// não em ordem alfabética do português: maiúsculas vêm antes de minúsculas e letras
// acentuadas vêm depois de "Z". Por isso a ordenação "alfabética" das listas é feita aqui,
// em JavaScript, com um collator de português — nunca com ORDER BY no SQL.
const COLLATOR_PT_BR = new Intl.Collator('pt-BR')

export function compararNomes(a: string, b: string): number {
  return COLLATOR_PT_BR.compare(a, b)
}

/**
 * "  Ana   Maria " → "Ana Maria", já em forma Unicode NFC.
 * O NFC não é enfeite: "é" pode ser gravado como um caractere ou como "e" + acento
 * combinante. São iguais na tela, mas o índice pessoas_nome_unico compara bytes —
 * sem normalizar, o mesmo nome vindo do Excel viraria uma segunda pessoa.
 * Mora em domain (não em db/cadastros.ts) porque a tradução da planilha também
 * precisa dela e é domínio puro, sem import de src/db — spec §6.8: é a mesma função
 * para nome de pessoa, categoria (src/db/cadastros.ts) e CATEGORIA/ORIGEM da
 * planilha (src/domain/planilha.ts).
 */
export function normalizarNome(nome: string): string {
  return nome.normalize('NFC').trim().replace(/\s+/g, ' ')
}
