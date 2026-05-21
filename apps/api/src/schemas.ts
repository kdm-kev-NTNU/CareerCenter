import { careerTracks, courseStatuses } from "@careercenter/shared";
import { z } from "zod";

export const courseSchema = z.object({
  semester: z.union([z.literal(7), z.literal(8), z.literal(9), z.literal(10)]),
  courseCode: z.string().min(1),
  title: z.string().min(1),
  credits: z.number().min(0).max(60),
  status: z.enum(courseStatuses),
  notes: z.string().default(""),
  trackTags: z.array(z.enum(careerTracks)).default([]),
  sortOrder: z.number().int().default(0)
});

export const pathSchema = z.object({
  name: z.string().min(1),
  description: z.string().default(""),
  targetRole: z.string().default(""),
  horizon: z.string().default(""),
  steps: z.array(
    z.object({
      companyId: z.string().min(1),
      order: z.number().int().min(0),
      note: z.string().default(""),
      targetRole: z.string().default("")
    })
  )
});

export const mapNodeSchema = z.object({
  title: z.string().min(1),
  items: z.array(z.string().min(1))
});

export const trackSchema = z.object({
  label: z.string().min(1)
});
