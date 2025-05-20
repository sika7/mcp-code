import { z } from "zod";

export const configSchema = z.object({
  debug: z.boolean().optional(),
  log_path: z.string().optional(),
  excluded_files: z.array(z.string()).optional(),
  rate_limit: z.number().optional(),
  current_project: z.string(),
  projects: z
    .record(
      z.object({
        rate_limit: z.number().optional(),
        src: z.string(),
        scripts: z.record(z.string()).optional(),
        excluded_files: z.array(z.string()).optional(),
      }).required(),
    )
});

export type Config = z.infer<typeof configSchema>;
