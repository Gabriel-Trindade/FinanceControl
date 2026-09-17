import { redirect } from 'next/navigation'

// Até o Plano 2 (tela "Quem me deve"), a entrada do site é a lista do mês.
export default function Inicio() {
  redirect('/lancamentos')
}
