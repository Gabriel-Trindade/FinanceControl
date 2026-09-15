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
})
