import { loginSchema, refreshSchema } from '@gex/shared';
import { createZodDto } from 'nestjs-zod';

// Classes só para o Swagger refletir os corpos; a validação é o próprio
// schema Zod, aplicado pelo ZodValidationPipe.
export class LoginDto extends createZodDto(loginSchema) {}
export class RefreshDto extends createZodDto(refreshSchema) {}
