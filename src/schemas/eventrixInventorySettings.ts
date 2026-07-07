import { z } from 'zod';

export const eventrixInventorySettingsSchema = z
  .object({
    environment: z.enum(['sandbox', 'production']),
    base_url: z.string().max(200).optional().nullable(),
    api_key_secret_name: z.string().max(120).optional().nullable(),
    is_enabled: z.boolean().default(false),
  })
  .refine(
    (data) => {
      if (!data.base_url) return true;
      try {
        new URL(data.base_url);
        return true;
      } catch {
        return false;
      }
    },
    { message: 'Informe uma URL válida.', path: ['base_url'] },
  );

export type EventrixInventorySettingsInput = z.infer<
  typeof eventrixInventorySettingsSchema
>;

export type EventrixInventoryStatus =
  | 'not_configured'
  | 'configured'
  | 'connected'
  | 'error'
  | 'disabled';

export type EventrixEnvironment = 'sandbox' | 'production';
