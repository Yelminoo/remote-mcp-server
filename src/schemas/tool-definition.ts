import { z } from "zod";

export const ParamSchema = z.object({
  name: z.string().min(1).max(64)
    .regex(/^[a-zA-Z][a-zA-Z0-9_]*$/, "must start with a letter; letters, digits, underscores only"),
  type: z.enum(["string", "number", "boolean"]).default("string"),
  description: z.string().max(500).default(""),
  required: z.boolean().default(false),
  in: z.enum(["path", "query", "body", "header"]),
});

export const ToolDefSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(64)
    .regex(/^[a-z][a-z0-9_]*$/, "lowercase letters, digits, underscores; must start with a letter"),
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(1000),
  method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]),
  url: z.string().min(4),
  headers: z.record(z.string()).default({}),
  params: z.array(ParamSchema).default([]),
  readOnlyHint: z.boolean().default(true),
  destructiveHint: z.boolean().default(false),
  enabled: z.boolean().default(true),
  createdAt: z.number(),
});

// Input schema for create/update (id and createdAt are generated server-side)
export const CreateToolSchema = ToolDefSchema.omit({ id: true, createdAt: true });

export type ParamDef = z.infer<typeof ParamSchema>;
export type ToolDef = z.infer<typeof ToolDefSchema>;
export type CreateToolInput = z.infer<typeof CreateToolSchema>;
