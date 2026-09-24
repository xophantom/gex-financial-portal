import { loginSchema } from '@gex/shared';
import { createZodDto } from 'nestjs-zod';

// Classe só para o Swagger refletir o corpo; a validação é o próprio schema
// Zod, aplicado pelo ZodValidationPipe no controller.
export class LoginDto extends createZodDto(loginSchema) {}
