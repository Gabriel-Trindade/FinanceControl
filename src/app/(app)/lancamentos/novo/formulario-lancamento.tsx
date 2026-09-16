'use client'

import { useState, useTransition, type ReactNode } from 'react'
import { unstable_rethrow } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { ehDataValida, mesParaTexto, sugerirMesFatura } from '@/domain/datas'
import { salvarLancamento } from './actions'
import type { CampoFormulario } from './validacao'

type Erros = Partial<Record<CampoFormulario, string>>

function Campo(props: { id: string; rotulo: string; erro?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={props.id}>{props.rotulo}</Label>
      {props.children}
      {props.erro && (
        <p role="alert" className="text-sm text-destructive">
          {props.erro}
        </p>
      )}
    </div>
  )
}

function Interruptor(props: { id: string; rotulo: string; ligado: boolean; aoMudar: (ligado: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <Label htmlFor={props.id}>{props.rotulo}</Label>
      <Switch id={props.id} checked={props.ligado} onCheckedChange={props.aoMudar} />
    </div>
  )
}

export function FormularioLancamento(props: { hoje: string; pessoas: string[]; categorias: string[] }) {
  const [pessoa, setPessoa] = useState('')
  const [valor, setValor] = useState('')
  const [credito, setCredito] = useState(false)
  const [item, setItem] = useState('')
  const [categoria, setCategoria] = useState('')
  const [dataCompra, setDataCompra] = useState(props.hoje)
  const [mesFatura, setMesFatura] = useState(mesParaTexto(sugerirMesFatura(props.hoje)))
  const [mesEscolhidoAMao, setMesEscolhidoAMao] = useState(false)
  const [parcelaAtual, setParcelaAtual] = useState('1')
  const [qtdParcelas, setQtdParcelas] = useState('1')
  const [recorrente, setRecorrente] = useState(false)
  const [recebido, setRecebido] = useState(false)
  const [erros, setErros] = useState<Erros>({})
  const [aviso, setAviso] = useState<string | null>(null)
  const [enviando, iniciarEnvio] = useTransition()

  function mudarDataCompra(nova: string) {
    setDataCompra(nova)
    // Enquanto ninguém escolheu o mês à mão, ele acompanha a regra do fechamento (R3).
    if (!mesEscolhidoAMao && ehDataValida(nova)) setMesFatura(mesParaTexto(sugerirMesFatura(nova)))
  }

  function enviar(depois: 'lista' | 'outro') {
    const dados = new FormData()
    dados.set('pessoa', pessoa)
    dados.set('valor', valor)
    dados.set('item', item)
    dados.set('categoria', categoria)
    dados.set('dataCompra', dataCompra)
    dados.set('mesFatura', mesFatura)
    dados.set('parcelaAtual', parcelaAtual)
    if (recorrente) dados.set('recorrente', 'on')
    else dados.set('qtdParcelas', qtdParcelas)
    if (credito) dados.set('credito', 'on')
    if (recebido) dados.set('recebido', 'on')
    dados.set('depois', depois)

    iniciarEnvio(async () => {
      try {
        const resultado = await salvarLancamento(dados)
        if (!resultado.ok) {
          setErros(resultado.erros)
          setAviso(resultado.erroGeral ?? null)
          return
        }
        // "Salvar e lançar outro": mantém pessoa, data da compra e mês da fatura; limpa o resto.
        setValor('')
        setItem('')
        setCategoria('')
        setCredito(false)
        setParcelaAtual('1')
        setQtdParcelas('1')
        setRecorrente(false)
        setRecebido(false)
        setErros({})
        setAviso('Lançamento salvo. Pode lançar o próximo.')
      } catch (erro) {
        // O redirect() de "Salvar" e o redirect da sessão expirada (exigirSessao) atravessam a Server
        // Action como um erro especial do Next; unstable_rethrow reconhece esse erro e o relança para
        // o Next terminar a navegação. Qualquer outro erro (rede caiu, deploy novo no ar) segue adiante.
        unstable_rethrow(erro)
        setAviso('Não foi possível salvar. Tente de novo.')
        return
      }
    })
  }

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(evento) => {
        evento.preventDefault()
        enviar('lista')
      }}
    >
      <Campo id="pessoa" rotulo="Pessoa" erro={erros.pessoa}>
        <Input id="pessoa" list="lista-pessoas" autoComplete="off" value={pessoa} onChange={(e) => setPessoa(e.target.value)} />
        {/* datalist: sugere os nomes existentes, mas aceita um nome novo (que é criado ao salvar) */}
        <datalist id="lista-pessoas">
          {props.pessoas.map((nome) => (
            <option key={nome} value={nome} />
          ))}
        </datalist>
      </Campo>

      <Campo id="valor" rotulo="Valor (R$)" erro={erros.valor}>
        {/* inputMode="decimal" abre o teclado numérico com vírgula no celular */}
        <Input id="valor" inputMode="decimal" placeholder="0,00" value={valor} onChange={(e) => setValor(e.target.value)} />
      </Campo>
      {/* O teclado decimal do iPhone não tem sinal de menos: o crédito vira um interruptor. */}
      <Interruptor id="credito" rotulo="É crédito (abate do que a pessoa deve)?" ligado={credito} aoMudar={setCredito} />

      <Campo id="item" rotulo="Item" erro={erros.item}>
        <Input id="item" value={item} onChange={(e) => setItem(e.target.value)} />
      </Campo>

      <Campo id="categoria" rotulo="Categoria" erro={erros.categoria}>
        <Input id="categoria" list="lista-categorias" autoComplete="off" value={categoria} onChange={(e) => setCategoria(e.target.value)} />
        <datalist id="lista-categorias">
          {props.categorias.map((nome) => (
            <option key={nome} value={nome} />
          ))}
        </datalist>
      </Campo>

      <div className="grid grid-cols-2 gap-3">
        <Campo id="dataCompra" rotulo="Data da compra" erro={erros.dataCompra}>
          <Input id="dataCompra" type="date" value={dataCompra} onChange={(e) => mudarDataCompra(e.target.value)} />
        </Campo>
        <Campo id="mesFatura" rotulo="Fatura" erro={erros.mesFatura}>
          <Input
            id="mesFatura"
            type="month"
            value={mesFatura}
            onChange={(e) => {
              setMesFatura(e.target.value)
              setMesEscolhidoAMao(true)
            }}
          />
        </Campo>
      </div>

      <Interruptor id="recorrente" rotulo="Recorrente (mensal)" ligado={recorrente} aoMudar={setRecorrente} />
      <div className="grid grid-cols-2 gap-3">
        <Campo id="parcelaAtual" rotulo="Parcela" erro={erros.parcelaAtual}>
          <Input id="parcelaAtual" type="number" inputMode="numeric" min={1} max={99} value={parcelaAtual} onChange={(e) => setParcelaAtual(e.target.value)} />
        </Campo>
        {!recorrente && (
          <Campo id="qtdParcelas" rotulo="De quantas" erro={erros.qtdParcelas}>
            <Input id="qtdParcelas" type="number" inputMode="numeric" min={1} max={99} value={qtdParcelas} onChange={(e) => setQtdParcelas(e.target.value)} />
          </Campo>
        )}
      </div>

      <Interruptor id="recebido" rotulo="Já recebi" ligado={recebido} aoMudar={setRecebido} />

      {aviso && (
        <p role="status" className="text-sm">
          {aviso}
        </p>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button type="submit" disabled={enviando}>
          {enviando ? 'Salvando…' : 'Salvar'}
        </Button>
        <Button type="button" variant="outline" disabled={enviando} onClick={() => enviar('outro')}>
          Salvar e lançar outro
        </Button>
      </div>
    </form>
  )
}
