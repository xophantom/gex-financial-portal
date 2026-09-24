import type { UserRole } from '@gex/shared'

// Quem fez a requisição: o que JwtStrategy.validate() põe em request.user e
// o que @CurrentUser() entrega aos controllers. Services e repositórios usam
// id e role para decidir escopo (FINANCE vê tudo, REQUESTER só o que é seu).
export interface AuthenticatedUser {
  id: string
  name: string
  email: string
  role: UserRole
}
