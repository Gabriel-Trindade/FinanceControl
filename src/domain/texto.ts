// O banco (PGlite com collation "C", Neon com "C.UTF-8") ordena pelo código do caractere,
// não em ordem alfabética do português: maiúsculas vêm antes de minúsculas e letras
// acentuadas vêm depois de "Z". Por isso a ordenação "alfabética" das listas é feita aqui,
// em JavaScript, com um collator de português — nunca com ORDER BY no SQL.
const COLLATOR_PT_BR = new Intl.Collator('pt-BR')

export function compararNomes(a: string, b: string): number {
  return COLLATOR_PT_BR.compare(a, b)
}
