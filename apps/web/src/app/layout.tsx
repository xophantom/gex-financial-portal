import type { Metadata } from 'next'
import { Bricolage_Grotesque, Public_Sans } from 'next/font/google'
import { NuqsAdapter } from 'nuqs/adapters/next/app'
import './globals.css'

// Public Sans para interface e tabelas (algarismos tabulares para dinheiro);
// Bricolage Grotesque para títulos e valores em destaque.
const publicSans = Public_Sans({
  variable: '--font-public-sans',
  subsets: ['latin'],
})

const bricolage = Bricolage_Grotesque({
  variable: '--font-bricolage',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: {
    default: 'Portal de Solicitações Financeiras',
    template: '%s · Portal de Solicitações Financeiras',
  },
  description: 'Cadastro, aprovação e pagamento de solicitações financeiras de fornecedores.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${publicSans.variable} ${bricolage.variable} h-full`}>
      <body className="min-h-full flex flex-col">
        {/* Um único adapter na raiz: nuqs precisa dele para ler e escrever a
            URL do App Router em qualquer tela que use useQueryStates. */}
        <NuqsAdapter>{children}</NuqsAdapter>
      </body>
    </html>
  )
}
