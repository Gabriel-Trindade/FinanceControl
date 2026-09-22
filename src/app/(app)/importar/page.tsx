import { exigirSessao } from '@/auth/sessao'
import { Assistente } from './assistente'

export default async function PaginaImportar() {
  // Reforço: o proxy já barra quem não tem sessão antes de chegar aqui (mesmo padrão de
  // src/app/(app)/lancamentos/page.tsx e do LayoutLogado).
  await exigirSessao()

  return <Assistente />
}
