import { getZodType, SchemaType } from './util';
import type { ResponseSchema, Schema } from "@google/generative-ai";
import { ZodFirstPartyTypeKind, type ZodRawShape, type ZodType, type ZodTypeAny, ZodArray, ZodObject } from 'zod';

function decorateGeminiSchema(geminiSchema: Schema, zodSchema: ZodType): Schema {
  if (geminiSchema.nullable === undefined) {
    geminiSchema.nullable = zodSchema.isOptional();
  }

  if (zodSchema.description) {
    geminiSchema.description = zodSchema.description;
  }

  return geminiSchema;
}

function decorateZodSchema(z: ZodType, geminiSchema: Schema) {
  if (geminiSchema.nullable) {
    z = z.nullable();
  }
  if (geminiSchema.description) {
    z = z.describe(geminiSchema.description);
  }

  return z;
}

export function toGeminiSchema(zodSchema: ZodTypeAny): ResponseSchema {
  const zodType = getZodType(zodSchema);

  switch (zodType) {
    case ZodFirstPartyTypeKind.ZodArray:
      const arraySchema = zodSchema as ZodArray<any, any>;
      return decorateGeminiSchema(
        {
          type: SchemaType.ARRAY,
          items: toGeminiSchema(arraySchema.element),
        },
        zodSchema,
      );
    case ZodFirstPartyTypeKind.ZodObject:
      const objectSchema = zodSchema as ZodObject<ZodRawShape, any, ZodTypeAny>;
      const properties: Record<string, any> = {};
      const required: string[] = [];

      Object.entries(objectSchema.shape).forEach(([key, value]: [string, any]) => {
        properties[key] = toGeminiSchema(value);
        if (getZodType(value) !== ZodFirstPartyTypeKind.ZodOptional) {
          required.push(key);
        }
      });

      return decorateGeminiSchema(
        {
          type: SchemaType.OBJECT,
          properties,
          required: required.length > 0 ? required : undefined,
        },
        zodSchema,
      );
    case ZodFirstPartyTypeKind.ZodString:
      return decorateGeminiSchema(
        {
          type: SchemaType.STRING,
        },
        zodSchema,
      );
    case ZodFirstPartyTypeKind.ZodNumber:
      return decorateGeminiSchema(
        {
          type: SchemaType.NUMBER,
        },
        zodSchema,
      );
    case ZodFirstPartyTypeKind.ZodBoolean:
      return decorateGeminiSchema(
        {
          type: SchemaType.BOOLEAN,
        },
        zodSchema,
      );
    case ZodFirstPartyTypeKind.ZodEnum:
      return decorateGeminiSchema(
        {
          type: SchemaType.STRING,
          enum: zodSchema._def.values,
        },
        zodSchema,
      );
    case ZodFirstPartyTypeKind.ZodDefault:
    case ZodFirstPartyTypeKind.ZodNullable:
    case ZodFirstPartyTypeKind.ZodOptional:
      const innerSchema = toGeminiSchema(zodSchema._def.innerType);
      return decorateGeminiSchema(
        {
          ...innerSchema,
          nullable: true,
        },
        zodSchema,
      );
    case ZodFirstPartyTypeKind.ZodLiteral:
      return decorateGeminiSchema(
        {
          type: SchemaType.STRING,
          enum: [zodSchema._def.value],
        },
        zodSchema,
      );
    default:
      return decorateGeminiSchema(
        {
          type: SchemaType.OBJECT,
          nullable: true,
        },
        zodSchema,
      );
  }
}

export function toZodSchema(geminiSchema: any): any {
  const z = require('zod'); // Dynamically import zod to avoid bundling it

  switch (geminiSchema.type) {
    case SchemaType.ARRAY:
      return decorateZodSchema(
        z.array(toZodSchema(geminiSchema.items)),
        geminiSchema,
      );

    case SchemaType.OBJECT:
      const shape: Record<string, any> = {};
      Object.entries(geminiSchema.properties).forEach(
        ([key, value]: [string, any]) => {
          let fieldSchema = toZodSchema(value);
          if (!geminiSchema.required || !geminiSchema.required.includes(key)) {
            fieldSchema = fieldSchema.optional();
          }
          shape[key] = fieldSchema;
        },
      );
      return decorateZodSchema(z.object(shape), geminiSchema);

    case SchemaType.STRING:
      return decorateZodSchema(z.string(), geminiSchema);

    case SchemaType.NUMBER:
    case SchemaType.INTEGER:
      return decorateZodSchema(z.number(), geminiSchema);

    case SchemaType.BOOLEAN:
      return decorateZodSchema(z.boolean(), geminiSchema);

    default:
      return decorateZodSchema(z.any(), geminiSchema);
  }
}