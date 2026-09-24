import type { ReactNode } from 'react'

// O caminho de uma solicitação, na ordem em que acontece. É conteúdo, não
// enfeite: diz a quem chega o que cada perfil faz no portal.
const STEPS = [
  {
    title: 'O solicitante lança a nota fiscal',
    detail: 'Fornecedor, valor, vencimento e competência.',
  },
  { title: 'O financeiro aprova ou rejeita', detail: 'Toda decisão fica registrada com o motivo.' },
  { title: 'O pagamento é registrado', detail: 'A solicitação fecha com a data em que foi paga.' },
]

// Moldura das telas sem sessão: em telas largas, o painel em tinta (o mesmo da
// sidebar) apresenta o portal e o formulário ocupa a direita; no celular, o
// painel encolhe para uma faixa com a marca e a frase, e o formulário vem logo
// abaixo.
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-full flex-1 flex-col lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <aside className="flex flex-col bg-sidebar px-5 py-4 text-sidebar-foreground lg:px-12 lg:py-10 xl:px-16">
        <Brand />

        <div className="flex flex-1 flex-col justify-center pt-7 pb-3 lg:py-16">
          <p className="max-w-md font-heading text-2xl sm:text-3xl lg:text-4xl leading-[1.1] font-semibold tracking-tight text-balance">
            Notas fiscais de fornecedores, do lançamento ao pagamento.
          </p>

          <ol className="mt-12 hidden max-w-md space-y-6 lg:block">
            {STEPS.map((step, index) => (
              <li key={step.title} className="relative flex gap-4">
                {index < STEPS.length - 1 && (
                  <span
                    aria-hidden="true"
                    className="absolute top-8 bottom-[-1.25rem] left-[0.8125rem] w-px bg-sidebar-border"
                  />
                )}
                <span
                  aria-hidden="true"
                  className="grid size-7 shrink-0 place-items-center rounded-full border border-sidebar-border font-heading text-xs font-semibold text-sidebar-muted"
                >
                  {index + 1}
                </span>
                <span className="pt-0.5">
                  <span className="block text-sm font-medium">{step.title}</span>
                  <span className="mt-0.5 block text-sm text-sidebar-muted">{step.detail}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>

        <p className="hidden text-xs text-sidebar-muted lg:block">
          Acesso restrito a colaboradores com conta ativa.
        </p>
      </aside>

      <main className="flex flex-1 items-start justify-center px-5 pt-12 pb-16 sm:items-center sm:py-16 lg:px-12">
        <div className="w-full max-w-sm">{children}</div>
      </main>
    </div>
  )
}

// Mesmo selo e mesma tipografia da sidebar autenticada, para que a troca de
// tela depois do login não pareça troca de produto.
function Brand() {
  return (
    <div className="flex items-center gap-3">
      <span
        aria-hidden="true"
        className="grid size-9 place-items-center rounded-md border-2 border-sidebar-foreground/80 font-heading text-[0.7rem] font-bold"
      >
        GEX
      </span>
      <span className="leading-tight">
        <span className="block font-heading text-base font-semibold">Contas a pagar</span>
        <span className="block text-xs text-sidebar-muted">Solicitações financeiras</span>
      </span>
    </div>
  )
}
