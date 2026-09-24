import { FileSearch } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'

// Também é o que um solicitante vê ao abrir a solicitação de outra pessoa: a
// API responde 404 (e não 403) para não revelar que o id existe.
export default function AppNotFound() {
  return (
    <Empty className="min-h-[60vh]">
      <EmptyHeader>
        <EmptyMedia variant="icon" className="size-12 rounded-lg">
          <FileSearch className="size-6" />
        </EmptyMedia>
        <EmptyTitle>
          <h1 className="text-2xl font-semibold">Solicitação ou página não encontrada</h1>
        </EmptyTitle>
        <EmptyDescription>
          O endereço pode estar incompleto, ou o item não está disponível para o seu perfil. Procure
          pelo fornecedor ou pelo status na lista de solicitações.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button asChild size="lg">
          <Link href="/requests">Voltar para solicitações</Link>
        </Button>
      </EmptyContent>
    </Empty>
  )
}
