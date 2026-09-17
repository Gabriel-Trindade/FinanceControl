import { exigirSessao } from '@/auth/sessao'
import { listarCategoriasAtivas, listarPessoasAtivas } from '@/db/cadastros'
import { obterDb } from '@/db/cliente'
import { hojeEmSaoPaulo } from '@/domain/datas'
import { FormularioLancamento } from './formulario-lancamento'

export default async function PaginaLancar() {
  await exigirSessao()
  const db = obterDb()
  const [pessoas, categorias] = await Promise.all([listarPessoasAtivas(db), listarCategoriasAtivas(db)])

  return (
    <>
      <h1 className="mb-4 text-xl font-semibold">Lançar</h1>
      <FormularioLancamento
        hoje={hojeEmSaoPaulo()}
        pessoas={pessoas.map((p) => p.nome)}
        categorias={categorias.map((c) => c.nome)}
      />
    </>
  )
}
