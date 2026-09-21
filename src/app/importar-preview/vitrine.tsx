'use client'

// Client Component: page.tsx (Server Component, só metadata) não pode passar funções comuns
// para componentes de cliente como TelaEscolher — só Server Action cruzaria essa fronteira
// (React recusa isso no build: "Functions cannot be passed directly to Client Components").
// Como esta vitrine não lê nada do servidor, virar Client Component inteira é seguro e é o
// mesmo padrão já usado em /importar (page.tsx Server + assistente.tsx Client).

import type { ReactNode } from 'react'
import type { LancamentoDaPlanilha, OcorrenciaDaPlanilha, ResultadoDaTraducao } from '@/domain/planilha'
import {
  Estepe,
  ListaDeOcorrencias,
  TelaCarregando,
  TelaEscolher,
  TelaErroConferencia,
  TelaErroGravacao,
  TelaGravando,
  TelaRelatorio,
  TelaRevisao,
} from '@/app/(app)/importar/componentes'

function lancamentoFicticio(mudancas: Partial<LancamentoDaPlanilha> = {}): LancamentoDaPlanilha {
  return {
    codPlanilha: 1,
    mesFatura: '2026-09-01',
    pessoa: 'Ana',
    categoria: 'Mercado',
    item: 'Compra do mês',
    valorCentavos: 15890,
    parcelaAtual: 1,
    qtdParcelas: 1,
    recorrente: false,
    pagamento: 'NAO',
    ...mudancas,
  }
}

const LANCAMENTOS_FICTICIOS: LancamentoDaPlanilha[] = [
  lancamentoFicticio({ codPlanilha: 1, item: 'Compra do mês', categoria: 'Mercado' }),
  lancamentoFicticio({
    codPlanilha: 2,
    pessoa: 'Bruno',
    item: 'Assinatura streaming',
    categoria: 'Lazer',
    valorCentavos: 2990,
    recorrente: true,
    qtdParcelas: null,
  }),
  lancamentoFicticio({
    codPlanilha: 3,
    pessoa: 'Carla',
    item: 'Tênis de corrida',
    categoria: 'Vestuário',
    valorCentavos: 43900,
    parcelaAtual: 2,
    qtdParcelas: 3,
  }),
]

const PROBLEMAS_FICTICIOS: OcorrenciaDaPlanilha[] = [
  { linha: 10, motivo: 'CÓD ausente, não numérico ou menor que 1' },
  { linha: 88, motivo: 'ITEM vazio' },
  { linha: 431, motivo: 'VALOR ausente ou não numérico' },
]

const AVISOS_FICTICIOS: OcorrenciaDaPlanilha[] = [
  { linha: 12, motivo: 'PARCELA ATUAL era 0, corrigida para 1' },
  { linha: 340, motivo: 'VALOR tinha mais de duas casas decimais; arredondado para o centavo mais próximo' },
]

const RESULTADO_FICTICIO: ResultadoDaTraducao = {
  lancamentos: LANCAMENTOS_FICTICIOS,
  problemas: PROBLEMAS_FICTICIOS,
  avisos: AVISOS_FICTICIOS,
}

function Secao(props: { titulo: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 border-b pb-8">
      <h2 className="font-mono text-xs tracking-wide text-muted-foreground uppercase">{props.titulo}</h2>
      <div className="rounded-lg border-2 border-dashed p-4">{props.children}</div>
    </section>
  )
}

function semAcao() {
  // no-op: os botões respondem (foco, hover, disabled) mesmo sem Server Action por trás —
  // só não navegam nem gravam nada, porque esta página não tem sessão.
}

export function Vitrine() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8 p-4">
      <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
        Vitrine de verificação visual do assistente de importação (Tarefa 11), com dados fictícios. Não é
        uma tela do produto — não lê nem grava nada de verdade. Ver comentário no topo de page.tsx.
      </div>

      <Secao titulo="Estepe — todas as posições">
        <div className="flex flex-col gap-4">
          <Estepe atual={0} />
          <Estepe atual={1} />
          <Estepe atual={2} />
          <Estepe atual={3} />
        </div>
      </Secao>

      <Secao titulo="Etapa 1 · Escolher — estado inicial">
        <TelaEscolher
          erro={null}
          aoEscolherArquivo={semAcao}
          estadoDesfazer={{ tipo: 'ocioso' }}
          aoConfirmarDesfazer={semAcao}
        />
      </Secao>

      <Secao titulo="Etapa 1 · Escolher — com erro de leitura">
        <TelaEscolher
          erro='A planilha não tem a aba "GASTOS".'
          aoEscolherArquivo={semAcao}
          estadoDesfazer={{ tipo: 'ocioso' }}
          aoConfirmarDesfazer={semAcao}
        />
      </Secao>

      <Secao titulo="Sub-passo · Carregando (lendo o arquivo / conferindo CÓDs)">
        <TelaCarregando mensagem="Lendo o arquivo…" />
      </Secao>

      <Secao titulo="Etapa 2 · Erro ao conferir">
        <TelaErroConferencia erro="Não foi possível conferir os CÓDs. Tente de novo." aoTentarDeNovo={semAcao} />
      </Secao>

      <Secao titulo="Etapa 2 · Revisão — com problemas e avisos">
        <TelaRevisao resultado={RESULTADO_FICTICIO} jaImportados={new Set()} aoConfirmar={semAcao} />
      </Secao>

      <Secao titulo="Etapa 2 · Revisão — tudo já importado (estado vazio que ensina)">
        <TelaRevisao
          resultado={{ ...RESULTADO_FICTICIO, problemas: [], avisos: [] }}
          jaImportados={new Set(LANCAMENTOS_FICTICIOS.map((l) => l.codPlanilha))}
          aoConfirmar={semAcao}
        />
      </Secao>

      <Secao titulo="Etapa 2 · Revisão — planilha sem nenhuma linha de dados">
        <TelaRevisao
          resultado={{ lancamentos: [], problemas: [], avisos: [] }}
          jaImportados={new Set()}
          aoConfirmar={semAcao}
        />
      </Secao>

      <Secao titulo="Etapa 2 · Lista de ocorrências — expandível (mais de 15 linhas)">
        <ListaDeOcorrencias
          titulo="Problemas — não serão gravados"
          tom="problema"
          itens={Array.from({ length: 22 }, (_, i) => ({ linha: 100 + i, motivo: 'ITEM vazio' }))}
        />
      </Secao>

      <Secao titulo="Etapa 3 · Gravando — em andamento">
        <TelaGravando loteAtual={4} totalLotes={10} gravados={1800} />
      </Secao>

      <Secao titulo="Etapa 3 · Erro ao gravar um lote (com retomar)">
        <TelaErroGravacao
          totalLotes={10}
          loteAtual={4}
          gravados={1800}
          erro="Não foi possível gravar este lote. Tente de novo."
          aoRetomar={semAcao}
        />
      </Secao>

      <Secao titulo="Etapa 4 · Relatório — painel de desfazer fechado (clique para abrir de verdade)">
        <TelaRelatorio
          gravados={4802}
          problemas={PROBLEMAS_FICTICIOS}
          avisos={AVISOS_FICTICIOS}
          estadoDesfazer={{ tipo: 'ocioso' }}
          quantidadeConhecidaParaDesfazer={4802}
          aoConfirmarDesfazer={semAcao}
        />
      </Secao>

      <Secao titulo="Etapa 4 · Relatório — desfazer em andamento">
        <TelaRelatorio
          gravados={4802}
          problemas={[]}
          avisos={[]}
          estadoDesfazer={{ tipo: 'apagando' }}
          quantidadeConhecidaParaDesfazer={4802}
          aoConfirmarDesfazer={semAcao}
        />
      </Secao>

      <Secao titulo="Etapa 4 · Relatório — desfazer concluído">
        <TelaRelatorio
          gravados={4802}
          problemas={[]}
          avisos={[]}
          estadoDesfazer={{ tipo: 'apagado', apagados: 4802 }}
          quantidadeConhecidaParaDesfazer={4802}
          aoConfirmarDesfazer={semAcao}
        />
      </Secao>
    </div>
  )
}
