import { Injectable, PipeTransform } from '@nestjs/common'
import type { ZodSchema } from 'zod'

@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema: ZodSchema) {}

  // O parâmetro metadata da interface PipeTransform não é usado — este pipe
  // sempre aplica o mesmo schema, injetado no construtor, não um por
  // parâmetro decorado. Omiti-lo é uma implementação válida da interface
  // (arity menor é atribuível) e evita um parâmetro morto só para satisfazer
  // uma assinatura que o TypeScript já aceita sem ele.
  transform(value: unknown): unknown {
    // Deixa o ZodError subir: o filtro global já o traduz em 422 com detalhes
    // por campo, e duplicar a tradução aqui criaria dois formatos de erro.
    return this.schema.parse(value)
  }
}
