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
    .transform((value) => value === "true"),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_TEXT_MODEL: z.string().default("gpt-4.1-mini"),
  OPENAI_VOICE_MODEL: z.string().default("gpt-live-1"),
  OPENAI_TRANSCRIBE_MODEL: z.string().default("whisper-1")
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  return envSchema.parse(source);
}

export const env = loadEnv();
