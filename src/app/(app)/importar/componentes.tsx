'use client'

// Peças de apresentação do assistente de importação — cada uma recebe o que precisa por
// props (nunca chama Server Action nem sabe o que é sessão). Testadas em componentes.test.tsx
// com renderToStaticMarkup (react-dom/server), que roda no ambiente 'node' do Vitest sem
// dependência nova — ver a Rodada de correção 1 do relatório da Tarefa 11 para o porquê de
// não ser mais uma vitrine em rota própria (src/app/importar-preview/, removida).

import { useRef, useState } from 'react'
import Link from 'next/link'
import {
  Check,
  CircleAlert,
  CircleCheck,
  Info,
  Loader2,
  RotateCcw,
  Trash2,
  TriangleAlert,
  Upload,
} from 'lucide-react'
import { cn } from 'cn'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { OcorrenciaDaPlanilha, ResultadoDaTraducao } from '@/domain/planilha'
import { formatarNumero, montarResumo, type EstadoDesfazer, type Etapa } from './logica'

const ETAPAS = ['Escolher', 'Conferir', 'Gravar', 'Relatório'] as const

/** Cabeçalho fixo do assistente: em qual das 4 etapas o dono está agora. Só o número (ou o
 *  check) fica visível — os 4 nomes por extenso lado a lado não cabem com folga em 375px
 *  (contando círculo + texto + conector das 4 etapas); o nome completo de cada etapa vai
 *  para leitor de tela (sr-only) e para o título da tela logo abaixo do Estepe
 *  (assistente.tsx), que também é visível para quem enxerga. */
export function Estepe({ atual }: { atual: Etapa }) {
  return (
    <ol aria-label="Etapas da importação" className="mb-6 flex items-center">
      {ETAPAS.map((rotulo, indice) => {
        const concluida = indice < atual
        const ativa = indice === atual
        return (
          <li
            key={rotulo}
            aria-current={ativa ? 'step' : undefined}
            className="flex flex-1 items-center last:flex-none"
          >
            <span
              className={cn(
                'flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-medium tabular-nums transition-colors duration-200',
                concluida && 'border-primary bg-primary text-primary-foreground',
                ativa && 'border-primary text-primary',
                !concluida && !ativa && 'border-border text-muted-foreground',
              )}
            >
              {concluida ? <Check aria-hidden="true" className="size-3.5" /> : indice + 1}
            </span>
            <span className="sr-only">
              {rotulo}
              {ativa ? ' (etapa atual)' : concluida ? ' (concluída)' : ''}
            </span>
            {indice < ETAPAS.length - 1 && (
              <span
                aria-hidden="true"
                className={cn('mx-1 h-px flex-1 transition-colors duration-200', concluida ? 'bg-primary' : 'bg-border')}
              />
            )}
          </li>
        )
      })}
    </ol>
  )
}

/** Texto exigido pelo brief da Tarefa 11, palavra por palavra — não é resumo nem paráfrase. */
export function AvisoAntesDeComecar() {
  return (
    <div role="note" className="flex items-start gap-2 rounded-md border p-3 text-sm text-muted-foreground">
      <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <p>
        Não feche nem saia desta página durante a importação. A planilha é lida no seu aparelho e não fica
        guardada em lugar nenhum — se você sair, vai precisar escolher o arquivo de novo.
      </p>
    </div>
  )
}

function SeletorDeArquivo({ erro, aoEscolher }: { erro: string | null; aoEscolher: (arquivo: File) => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  return (
    <div className="flex flex-col gap-2">
      {/* Input nativo escondido: continua sendo ele o controle "de verdade" (é quem abre o
          seletor do sistema operacional), o botão visível só delega o clique. tabIndex=-1 +
          aria-hidden tiram o input duplicado do Tab — sem isso haveria duas paradas de
          teclado para uma única ação. */}
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(evento) => {
          const arquivo = evento.target.files?.[0]
          // Limpa o valor: sem isso, escolher de novo o MESMO arquivo (depois de corrigir e
          // tentar outra vez) não dispara onChange na segunda vez, porque para o navegador
          // "não mudou" — e a tela ficaria parada em silêncio.
          evento.target.value = ''
          if (arquivo) aoEscolher(arquivo)
        }}
      />
      <Button
        type="button"
        className="min-h-11 w-full gap-2"
        aria-invalid={erro ? true : undefined}
        aria-describedby={erro ? 'erro-arquivo' : undefined}
        onClick={() => inputRef.current?.click()}
      >
        <Upload aria-hidden="true" className="size-4" />
        Escolher arquivo .xlsx
      </Button>
      {erro && (
        <p id="erro-arquivo" role="alert" className="text-sm text-destructive">
          {erro}
        </p>
      )}
    </div>
  )
}

/** Etapa 1. */
export function TelaEscolher(props: {
  erro: string | null
  aoEscolherArquivo: (arquivo: File) => void
  estadoDesfazer: EstadoDesfazer
  aoConfirmarDesfazer: () => void
}) {
  return (
    <div className="flex flex-col gap-4">
      <AvisoAntesDeComecar />
      <SeletorDeArquivo erro={props.erro} aoEscolher={props.aoEscolherArquivo} />
      <PainelDesfazer estado={props.estadoDesfazer} aoConfirmar={props.aoConfirmarDesfazer} />
    </div>
  )
}

/** Sub-passo transitório de "Escolher" (lendo o arquivo) e de "Conferir" (checando CÓDs no
 *  banco) — mesma aparência, texto diferente. Precisa pintar ANTES de lerPlanilha travar a
 *  thread principal por ~119ms; quem garante isso é assistente.tsx (aguardarPintura), não
 *  este componente. */
export function TelaCarregando({ mensagem }: { mensagem: string }) {
  return (
    <div role="status" aria-live="polite" className="flex items-center gap-3 rounded-md border p-4 text-sm">
      <Loader2 aria-hidden="true" className="size-4 shrink-0 animate-spin motion-reduce:animate-none" />
      <span>{mensagem}</span>
    </div>
  )
}

export function TelaErroConferencia({ erro, aoTentarDeNovo }: { erro: string; aoTentarDeNovo: () => void }) {
  return (
    <div className="flex flex-col gap-3 rounded-md border border-destructive/40 p-4">
      <p role="alert" className="flex items-start gap-2 text-sm text-destructive">
        <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        {erro}
      </p>
      <Button type="button" className="min-h-11" onClick={aoTentarDeNovo}>
        Tentar de novo
      </Button>
    </div>
  )
}

function ResumoNumerico(props: { lidas: number; novas: number; jaImportadas: number; comProblema: number }) {
  const itens = [
    { rotulo: 'Linhas lidas', valor: props.lidas },
    { rotulo: 'Novas', valor: props.novas },
    { rotulo: 'Já importadas', valor: props.jaImportadas },
    { rotulo: 'Com problema', valor: props.comProblema },
  ]
  return (
    <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {itens.map((item) => (
        <div key={item.rotulo} className="rounded-md border p-2 text-center">
          <dt className="text-xs text-muted-foreground">{item.rotulo}</dt>
          <dd className="font-semibold tabular-nums">{formatarNumero(item.valor)}</dd>
        </div>
      ))}
    </dl>
  )
}

/** Reaproveitada nas duas listas (problemas e avisos) da etapa "Conferir" e do relatório
 *  final — só muda o título, o ícone/cor e os itens. Corta em 15 linhas visíveis por
 *  padrão: uma planilha com centenas de avisos não deveria travar o celular do dono
 *  desenhando tudo de uma vez. */
export function ListaDeOcorrencias(props: {
  titulo: string
  tom: 'problema' | 'aviso'
  itens: OcorrenciaDaPlanilha[]
}) {
  const [expandido, setExpandido] = useState(false)
  const LIMITE = 15
  const visiveis = expandido ? props.itens : props.itens.slice(0, LIMITE)
  const Icone = props.tom === 'problema' ? TriangleAlert : Info

  return (
    <section className="rounded-md border p-3">
      <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
        <Icone aria-hidden="true" className={cn('size-4 shrink-0', props.tom === 'problema' && 'text-destructive')} />
        {props.titulo} ({formatarNumero(props.itens.length)})
      </h3>
      <ul className="flex flex-col gap-1 text-sm">
        {visiveis.map((item, indice) => (
          <li key={`${item.linha}-${indice}`} className={props.tom === 'problema' ? 'text-destructive' : 'text-foreground'}>
            Linha {item.linha}: {item.motivo}
          </li>
        ))}
      </ul>
      {props.itens.length > LIMITE && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="mt-2 min-h-11"
          aria-expanded={expandido}
          onClick={() => setExpandido((v) => !v)}
        >
          {expandido ? 'Mostrar menos' : `Mostrar todas as ${formatarNumero(props.itens.length)} linhas`}
        </Button>
      )}
    </section>
  )
}

/** Etapa 2. */
export function TelaRevisao(props: {
  resultado: ResultadoDaTraducao
  jaImportados: Set<number>
  aoConfirmar: () => void
}) {
  const resumo = montarResumo(props.resultado, props.jaImportados)
  return (
    <div className="flex flex-col gap-4">
      <ResumoNumerico {...resumo} />
      {props.resultado.problemas.length > 0 && (
        <ListaDeOcorrencias titulo="Problemas — não serão gravados" tom="problema" itens={props.resultado.problemas} />
      )}
      {props.resultado.avisos.length > 0 && (
        <ListaDeOcorrencias titulo="Avisos" tom="aviso" itens={props.resultado.avisos} />
      )}
      {resumo.novas > 0 ? (
        // O número já é o que de fato entra: lançamentos já importados são filtrados antes
        // de montar os lotes (assistente.tsx), então "Gravar N" e o que o banco recebe batem.
        <Button type="button" className="min-h-11" onClick={props.aoConfirmar}>
          {`Gravar ${formatarNumero(resumo.novas)} lançamento${resumo.novas === 1 ? '' : 's'}`}
        </Button>
      ) : resumo.lidas === 0 ? (
        <p className="rounded-md border p-4 text-sm text-muted-foreground">
          A planilha não tem nenhuma linha de dados na aba GASTOS.
        </p>
      ) : resumo.jaImportadas > 0 ? (
        <p className="rounded-md border p-4 text-sm text-muted-foreground">
          Todos os {formatarNumero(resumo.jaImportadas)} lançamentos desta planilha já foram importados. Não
          há nada novo para gravar.
        </p>
      ) : (
        // Só sobra este caso quando novas = 0, jaImportadas = 0 e lidas > 0 — pela conta de
        // montarResumo isso só acontece com lancamentos.length = 0 e problemas.length > 0,
        // ou seja, a lista de problemas logo acima SEMPRE existe quando este texto aparece.
        <p className="rounded-md border p-4 text-sm text-muted-foreground">
          Nenhuma linha desta planilha virou lançamento válido — confira a lista de problemas acima.
        </p>
      )}
    </div>
  )
}

/** Etapa 3, em andamento. `role="status"` já embute aria-live="polite" e aria-atomic="true"
 *  por padrão (WAI-ARIA); deixamos os dois explícitos porque é o que o brief pede e porque
 *  a busca "progress bar live region status" da skill ui-ux-pro-max (domínio ux) recomenda
 *  UMA mensagem de status atômica por mudança, nunca um número solto anunciado sozinho.
 *
 *  A região viva cobre só o `<p>` de status e o `<progress>` — o aviso "não feche" é texto
 *  ESTÁTICO (não muda lote a lote) e fica FORA dela. Com aria-atomic="true" na Rodada 1 ele
 *  estava dentro: cada um dos ~10 lotes reanunciava a frase inteira de novo, sem nada de novo
 *  para o dono ouvir ali. */
export function TelaGravando(props: { loteAtual: number; totalLotes: number; gravados: number }) {
  // loteAtual conta LOTES CONCLUÍDOS (0 no primeiro quadro, antes de qualquer resposta
  // chegar) — certo para a barra (o preenchimento começa vazio), errado para o texto: "Lote 0
  // de 10" no primeiro instante, e a barra nunca mostraria "Lote 10 de 10" com o 10º ainda em
  // voo. O texto soma 1 (sem passar de totalLotes) para descrever o lote EM CURSO, não os já
  // terminados.
  const loteEmCurso = Math.min(props.loteAtual + 1, props.totalLotes)
  return (
    <div className="flex flex-col gap-3 rounded-md border p-4">
      <div role="status" aria-live="polite" aria-atomic="true" className="flex flex-col gap-3">
        <p className="text-sm font-medium tabular-nums">
          Lote {loteEmCurso} de {props.totalLotes} · {formatarNumero(props.gravados)} gravados
        </p>
        {/* <progress> já expõe role="progressbar" e aria-valuenow/min/max sozinho a partir de
            value/max — não precisa de ARIA manual por cima. Só o NOME acessível não vem de
            graça (não há <label for> para um elemento de progresso): sem aria-label, um
            leitor de tela anunciaria só "progressbar, 40%", sem dizer do que. */}
        <progress
          value={props.loteAtual}
          max={props.totalLotes}
          aria-label="Progresso da gravação dos lançamentos"
          className="h-2 w-full accent-primary"
        />
      </div>
      <p className="text-xs text-muted-foreground">Não feche nem saia desta página até terminar.</p>
    </div>
  )
}

export function TelaErroGravacao(props: {
  totalLotes: number
  loteAtual: number
  gravados: number
  erro: string
  aoRetomar: () => void
}) {
  return (
    <div className="flex flex-col gap-3 rounded-md border border-destructive/40 p-4">
      <p role="alert" className="flex items-start gap-2 text-sm text-destructive">
        <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        {props.erro}
      </p>
      <p className="text-sm tabular-nums">
        Gravados {formatarNumero(props.gravados)} lançamentos, em {props.loteAtual} de{' '}
        {formatarNumero(props.totalLotes)} lotes.
      </p>
      {/* "Retomar" sempre refaz do lote 1 — nunca continua do lote que falhou. Seguro porque
          gravarLoteAction é idempotente (ON CONFLICT DO NOTHING): os lotes que já entraram
          são reenviados e simplesmente não fazem nada na segunda vez. */}
      <Button type="button" className="min-h-11 gap-2" onClick={props.aoRetomar}>
        <RotateCcw aria-hidden="true" className="size-4" />
        Retomar
      </Button>
    </div>
  )
}

/** Etapa 4. */
export function TelaRelatorio(props: {
  gravados: number
  problemas: OcorrenciaDaPlanilha[]
  avisos: OcorrenciaDaPlanilha[]
  estadoDesfazer: EstadoDesfazer
  aoConfirmarDesfazer: () => void
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-3 rounded-md border p-4">
        <CircleCheck aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-situacao-recebido" />
        <div>
          <p className="font-semibold tabular-nums">{formatarNumero(props.gravados)} lançamentos gravados</p>
          <p className="text-sm text-muted-foreground">Já aparecem na sua lista de lançamentos.</p>
        </div>
      </div>
      {props.problemas.length > 0 && (
        <ListaDeOcorrencias titulo="Ignorados por problema" tom="problema" itens={props.problemas} />
      )}
      {props.avisos.length > 0 && <ListaDeOcorrencias titulo="Avisos" tom="aviso" itens={props.avisos} />}
      <Link href="/lancamentos" className={cn(buttonVariants({ variant: 'default' }), 'min-h-11')}>
        Ver lançamentos
      </Link>
      <PainelDesfazer estado={props.estadoDesfazer} aoConfirmar={props.aoConfirmarDesfazer} />
    </div>
  )
}

/**
 * Entrada discreta (brief, Passo 3): nunca ao lado do botão de gravar, sempre depois de um
 * divisor. Aparece em dois lugares — TelaEscolher e TelaRelatorio — e não anuncia um número
 * antes de confirmar. A 1ª rodada desta tarefa tentou estimar (`jaImportados.size + gravados`
 * desta sessão) só na etapa 4; a revisão apontou dois jeitos previsíveis de errar mesmo assim:
 * depois de uma retomada (o total já muda de sentido — ver a correção em `assistente.tsx`,
 * `retomar`) e sempre que uma importação ANTERIOR tiver deixado linhas de fora da planilha
 * atual, porque `desfazerAction` apaga TODO `fonte = 'planilha'`, não só o que esta sessão
 * viu. Criar a consulta que daria o número exato é mexer em `src/db/importacao.ts` — fora
 * deste papel (é "consulta", explicitamente do Cérebro). Por isso: mesmo texto honesto nos
 * dois lugares, sem número prometido; o resultado real (`apagados`, devolvido por
 * `desfazerAction`) só aparece DEPOIS de confirmar, e nunca precisa bater com uma promessa
 * anterior porque não há promessa.
 */
export function PainelDesfazer(props: {
  estado: EstadoDesfazer
  aoConfirmar: () => void
  // Só para abrir o painel já expandido num render estático (componentes.test.tsx não simula
  // clique — renderToStaticMarkup não tem DOM nem evento). Produção nunca passa isto: todo
  // painel começa fechado, como o brief pede ("fora do caminho feliz").
  abertoInicial?: boolean
}) {
  const [aberto, setAberto] = useState(props.abertoInicial ?? false)
  const [digitado, setDigitado] = useState('')
  const liberado = digitado === 'APAGAR'
  const apagando = props.estado.tipo === 'apagando'

  if (props.estado.tipo === 'apagado') {
    return (
      <p role="status" className="border-t pt-4 text-sm text-muted-foreground">
        {formatarNumero(props.estado.apagados)} lançamentos apagados. Você pode importar a planilha de novo
        quando quiser.
      </p>
    )
  }

  if (!aberto) {
    return (
      <div className="border-t pt-4">
        <Button
          type="button"
          variant="ghost"
          className="min-h-11 gap-2 text-muted-foreground"
          onClick={() => setAberto(true)}
        >
          <Trash2 aria-hidden="true" className="size-4" />
          Desfazer importação
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3 border-t pt-4">
      <h3 className="text-sm font-semibold">Desfazer importação</h3>
      <p className="text-sm text-muted-foreground">
        Isso apaga todos os lançamentos que vieram da planilha — os de agora e os de qualquer importação
        anterior. Lançamentos que você lançou à mão, ou que vieram de fatura ou de virada de mês, não são
        afetados.
      </p>
      <p className="text-sm">Não dá para saber o número exato antes de confirmar — ele aparece logo depois.</p>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="confirmar-apagar">Para confirmar, digite APAGAR</Label>
        <Input
          id="confirmar-apagar"
          className="min-h-11"
          autoComplete="off"
          value={digitado}
          onChange={(evento) => setDigitado(evento.target.value)}
          aria-describedby="ajuda-apagar"
        />
        <p id="ajuda-apagar" className="text-xs text-muted-foreground">
          Digite a palavra <strong>APAGAR</strong>, em maiúsculas, para liberar o botão abaixo.
        </p>
      </div>

      {props.estado.tipo === 'erro' && (
        <p role="alert" className="flex items-start gap-2 text-sm text-destructive">
          <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          {props.estado.erro}
        </p>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          type="button"
          variant="destructive"
          className="min-h-11"
          disabled={!liberado || apagando}
          onClick={props.aoConfirmar}
        >
          {apagando ? 'Apagando…' : 'Apagar os lançamentos importados'}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          disabled={apagando}
          onClick={() => {
            setAberto(false)
            setDigitado('')
          }}
        >
          Cancelar
        </Button>
      </div>
    </div>
  )
}
