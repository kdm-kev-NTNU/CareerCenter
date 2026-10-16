import { z } from "zod";
import { DEFAULT_RESEARCH_MODEL, researchModels } from "./interviewPrep.js";

const DEFAULT_PROMPTS = [
  "Fortell om en gang du tok initiativ under tidspress.",
  "Hvorfor vil du jobbe hos oss?",
  "Beskriv en konflikt du løste konstruktivt."
];

export const videoSimulatorSettingsSchema = z.object({
  thinkSeconds: z.number().int().min(5).max(180).default(30),
  answerSeconds: z.number().int().min(15).max(600).default(90),
  prompts: z.array(z.string().min(1)).default(DEFAULT_PROMPTS),
  ratingModel: z.enum(researchModels).default(DEFAULT_RESEARCH_MODEL)
});

export type VideoSimulatorSettings = z.infer<typeof videoSimulatorSettingsSchema>;

export const defaultVideoSimulatorSettings: VideoSimulatorSettings = {
  thinkSeconds: 30,
  answerSeconds: 90,
  prompts: [...DEFAULT_PROMPTS],
  ratingModel: DEFAULT_RESEARCH_MODEL
};
