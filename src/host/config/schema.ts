import { z } from 'zod'
import { readFileSync } from 'fs'
import yaml from 'js-yaml'

// ── Provider configs ──────────────────────────────────────────────────────────

const OllamaConfig = z.object({
  baseUrl: z.string().default('http://localhost:11434'),
  model: z.string(),
  options: z.object({
    temperature: z.number().optional(),
    num_ctx: z.number().optional(),
  }).optional(),
})

const OpenAIConfig = z.object({
  apiKey: z.string(),
  model: z.string().default('gpt-4o-mini'),
  baseUrl: z.string().optional(),
  options: z.object({
    temperature: z.number().optional(),
    maxTokens: z.number().optional(),
  }).optional(),
})

const AnthropicConfig = z.object({
  apiKey: z.string(),
  model: z.string().default('claude-sonnet-4-6'),
  options: z.object({
    maxTokens: z.number().default(4096),
    temperature: z.number().optional(),
  }).optional(),
})

const GroqConfig = z.object({
  apiKey: z.string(),
  model: z.string().default('llama-3.3-70b-versatile'),
})

const GeminiConfig = z.object({
  apiKey: z.string(),
  model: z.string().default('gemini-2.0-flash'),
})

// ── MCP Server configs ────────────────────────────────────────────────────────

const StdioServerConfig = z.object({
  command: z.string(),
  args: z.array(z.string()).default([]),
  env: z.record(z.string()).optional(),
})

const HttpServerConfig = z.object({
  type: z.literal('http'),
  url: z.string(),
  headers: z.record(z.string()).optional(),
})

const McpServerConfig = z.union([StdioServerConfig, HttpServerConfig])

// ── Root config ───────────────────────────────────────────────────────────────

export const ConfigSchema = z.object({
  provider: z.enum(['ollama', 'openai', 'anthropic', 'groq', 'gemini', 'openai-compat']),

  providers: z.object({
    ollama: OllamaConfig.optional(),
    openai: OpenAIConfig.optional(),
    anthropic: AnthropicConfig.optional(),
    groq: GroqConfig.optional(),
    gemini: GeminiConfig.optional(),
    'openai-compat': OpenAIConfig.optional(),
  }).optional(),

  mcpServers: z.record(McpServerConfig).default({}),

  agent: z.object({
    systemPrompt: z.string().default('You are a helpful assistant with access to tools.'),
    maxToolRounds: z.number().default(10),
    toolTimeout: z.number().default(30000),
  }).default({}),
})

export type Config = z.infer<typeof ConfigSchema>
export type McpServerConfigType = z.infer<typeof McpServerConfig>

// ── Env var interpolation ─────────────────────────────────────────────────────

function interpolateEnv(obj: unknown): unknown {
  if (typeof obj === 'string') {
    return obj.replace(/\$\{([^}]+)\}/g, (_, key) => process.env[key] ?? '')
  }
  if (Array.isArray(obj)) return obj.map(interpolateEnv)
  if (obj && typeof obj === 'object') {
    return Object.fromEntries(
      Object.entries(obj).map(([k, v]) => [k, interpolateEnv(v)])
    )
  }
  return obj
}

// ── Loader ────────────────────────────────────────────────────────────────────

export function loadConfig(path: string): Config {
  const raw = yaml.load(readFileSync(path, 'utf8'))
  const interpolated = interpolateEnv(raw)
  const result = ConfigSchema.safeParse(interpolated)
  if (!result.success) {
    console.error('Config validation failed:')
    console.error(result.error.format())
    process.exit(1)
  }
  return result.data
}
