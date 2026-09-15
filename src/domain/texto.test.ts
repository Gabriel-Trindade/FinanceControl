import { describe, expect, it } from 'vitest'
import { compararNomes } from './texto'

describe('compararNomes', () => {
  it('ordena em português, não pelo código do caractere', () => {
    const nomes = ['Zé', 'bia', 'Álvaro', 'Ana', 'iFood', 'Érica', 'Carlos', 'Água']
    expect([...nomes].sort(compararNomes)).toEqual([
      'Água',
      'Álvaro',
      'Ana',
      'bia',
      'Carlos',
      'Érica',
      'iFood',
      'Zé',
    ])
  })
})
