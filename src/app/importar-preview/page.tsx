import type { Metadata } from 'next'
import { Vitrine } from './vitrine'

/**
 * Vitrine com os estados do assistente de importação, montados com dados FICTÍCIOS — NÃO é
 * uma tela do produto. Os componentes de apresentação de importar/componentes.tsx não chamam
 * Server Action nem sabem o que é sessão (recebem tudo por props), então dá para montá-los
 * aqui, fora do fluxo real, sem tocar em lerPlanilha/traduzirPlanilha nem no banco.
 *
 * IMPORTANTE, registrado depois de eu tentar o caminho errado: esta rota NÃO é pública.
 * `src/proxy.ts` protege tudo por *path*, com uma lista de exceção só para "login" (e
 * internals do Next) — colocar a página fora do grupo de rotas `(app)` não isenta nada, o
 * matcher não olha para grupo de rotas. Cheguei a achar que bastava sair do `(app)` (era a
 * leitura mais direta de "força o estado numa rota pública" no meu brief); testei no
 * navegador e o proxy redirecionou para /login igual a /importar. Corrigido aqui para quem
 * ler este arquivo depois não repetir a mesma suposição.
 *
 * Dado esse limite, e como mudar `src/proxy.ts` para abrir uma exceção seria exatamente
 * "contornar o proxy" (proibido pelo CLAUDE.md, sem exceção para caso de teste), esta rota
 * fica do mesmo lado do login que qualquer outra: quem tiver uma sessão válida — o dono, ou
 * o Cérebro com a senha — consegue abrir /importar-preview depois de entrar normalmente por
 * /login, e ver de uma vez todos os estados do assistente (etapas, erros, progresso,
 * desfazer) sem precisar montar cada um manualmente. É a única verificação visual em
 * navegador que ficou possível nesta tarefa; o relatório da Tarefa 11 detalha o que foi
 * verificado por outros meios (build, tipos, testes) no lugar disso.
 *
 * Dados fictícios: repetem os mesmos nomes genéricos já usados nos testes do projeto
 * (actions.test.ts, logica.test.ts) — nunca um dado real do dono. "noindex" só para não
 * aparecer em busca; a página não lê nem grava nada de verdade.
 *
 * page.tsx fica Server Component só por causa do `metadata` (proibido num Client Component);
 * todo o conteúdo mora em vitrine.tsx, que precisa ser Client Component para poder passar
 * funções comuns (não Server Actions) para TelaEscolher e companhia — mesma separação de
 * page.tsx/assistente.tsx que a Tarefa 11 já usa na rota de verdade.
 */
export const metadata: Metadata = { robots: 'noindex, nofollow' }

export default function ImportarPreview() {
  return <Vitrine />
}
