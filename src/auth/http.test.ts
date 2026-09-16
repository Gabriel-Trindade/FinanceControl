import { describe, expect, it } from 'vitest'
import { DESTINO_PADRAO, destinoSeguro, obterIp } from './http'

describe('obterIp', () => {
  it('usa o primeiro IP do x-forwarded-for', () => {
    expect(obterIp(new Headers({ 'x-forwarded-for': '203.0.113.7, 10.0.0.1' }))).toBe('203.0.113.7')
  })

  it('usa o x-real-ip quando não há x-forwarded-for', () => {
    expect(obterIp(new Headers({ 'x-real-ip': '198.51.100.1' }))).toBe('198.51.100.1')
  })

  it('devolve "desconhecido" sem cabeçalhos', () => {
    expect(obterIp(new Headers())).toBe('desconhecido')
  })

  it('prioriza x-vercel-forwarded-for mesmo com um x-forwarded-for forjado', () => {
    expect(
      obterIp(
        new Headers({
          'x-vercel-forwarded-for': '203.0.113.7',
          'x-forwarded-for': '198.51.100.99, 10.0.0.1',
        }),
      ),
    ).toBe('203.0.113.7')
  })
})

describe('destinoSeguro', () => {
  it('aceita caminho interno com query', () => {
    expect(destinoSeguro('/lancamentos?mes=2026-09')).toBe('/lancamentos?mes=2026-09')
  })

  it.each([
    null,
    undefined,
    '',
    'https://site-malicioso.com',
    '//site-malicioso.com',
    '/\\site-malicioso.com',
    '/login',
    '/\t/site-malicioso.com',
    '/\n/site-malicioso.com',
  ])('troca "%s" pelo destino padrão', (voltar) => {
    expect(destinoSeguro(voltar)).toBe(DESTINO_PADRAO)
  })

  it('troca por padrão quando "voltar" repete na query e chega como array', () => {
    // Next entrega array quando a query tem a mesma chave duas vezes: ?voltar=/a&voltar=/b
    expect(destinoSeguro(['/a', '/b'])).toBe(DESTINO_PADRAO)
  })
})
