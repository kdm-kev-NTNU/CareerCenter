import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  DATABASE_URL: z.string().optional(),
  CAREERCENTER_REPOSITORY: z.enum(["memory", "prisma"]).optional(),
  JWT_SECRET: z.string().min(32),
  UPLOAD_DIR: z.string().default("./uploads"),
  AUTH_DISABLED: z
    .enum(["true", "false"])
    .optional()
    .default("false")
    .transform((value) => value === "true")
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  return envSchema.parse(source);
}

export const env = loadEnv();
