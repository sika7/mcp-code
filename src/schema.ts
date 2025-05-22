import { z } from 'zod'

export const configSchema = z.object({
  log_path: z.string().optional(),
  excluded_files: z.array(z.string()).optional(),
  current_project: z.string(),
  projects: z.record(
    z
      .object({
        src: z.string(),
        scripts: z.record(z.string()).optional(),
        excluded_files: z.array(z.string()).optional(),
      })
      .required(),
  ),
})

export type Config = z.infer<typeof configSchema>
