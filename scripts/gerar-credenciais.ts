import { randomBytes } from 'node:crypto'
import { stdin as input, stdout as output } from 'node:process'
import { createInterface } from 'node:readline/promises'
import { gerarHashSenha } from '../src/auth/senha'

async function principal() {
  const leitor = createInterface({ input, output })
  console.log('Atenção: a senha aparece na tela enquanto você digita.')
  const senha = await leitor.question('Senha do FinanceControl (mínimo 12 caracteres): ')
  leitor.close()

  if (senha.length < 12) {
    console.error('Senha muito curta: use pelo menos 12 caracteres.')
    process.exit(1)
  }

  console.log('\nCopie estas linhas para o .env.local e para as variáveis da Vercel:\n')
  console.log(`AUTH_SENHA_HASH=${await gerarHashSenha(senha)}`)
  console.log(`AUTH_SEGREDO=${randomBytes(32).toString('base64url')}`)
}

void principal()
