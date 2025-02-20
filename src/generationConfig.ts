import type { ResponseSchema } from "@google/generative-ai";
import { toGeminiSchema } from ".";
import type { ZodTypeAny } from "zod";

export function responseSchemaFromZod(zodSchema: ZodTypeAny): { responseSchema: ResponseSchema, responseMimeType: string } {
  return {
    responseMimeType: "application/json",
    responseSchema: toGeminiSchema(zodSchema),
  }
};

