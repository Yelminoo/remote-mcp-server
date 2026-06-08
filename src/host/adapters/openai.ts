import { LLMAdapter, ChatRequest, ChatResponse, ToolCall, Message } from './base.js'

interface OpenAIAdapterConfig {
  apiKey: string
  model: string
  baseUrl?: string
  options?: { temperature?: number; maxTokens?: number }
}

export class OpenAIAdapter implements LLMAdapter {
  readonly name: string
  private baseUrl: string

  constructor(private config: OpenAIAdapterConfig, name = 'openai') {
    this.name = name
    this.baseUrl = config.baseUrl ?? 'https://api.openai.com/v1'
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    const messages = this.toOpenAIMessages(request.messages, request.systemPrompt)

    const tools = request.tools.map(t => ({
      type: 'function' as const,
      function: {
        name: t.name,
        description: t.description ?? '',
        parameters: t.inputSchema,
      },
    }))

    const body: Record<string, unknown> = {
      model: this.config.model,
      messages,
      temperature: request.temperature ?? this.config.options?.temperature ?? 0.7,
      max_tokens: request.maxTokens ?? this.config.options?.maxTokens ?? 4096,
    }

    if (tools.length > 0) {
      body.tools = tools
      body.tool_choice = 'auto'
    }

    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify(body),
    })

    if (!res.ok) throw new Error(`${this.name} error: ${res.status} ${await res.text()}`)

    const data = await res.json() as {
      choices: Array<{
        message: {
          content: string | null
          tool_calls?: Array<{ id: string; function: { name: string; arguments: string } }>
        }
        finish_reason: string
      }>
      usage?: { prompt_tokens: number; completion_tokens: number }
    }

    const choice = data.choices[0]
    const rawToolCalls = choice.message.tool_calls ?? []

    const toolCalls: ToolCall[] = rawToolCalls.map(tc => ({
      id: tc.id,
      name: tc.function.name,
      arguments: JSON.parse(tc.function.arguments),
    }))

    const stopReason =
      choice.finish_reason === 'tool_calls' ? 'tool_use' as const
      : choice.finish_reason === 'length' ? 'max_tokens' as const
      : 'end_turn' as const

    return {
      content: choice.message.content ?? '',
      toolCalls,
      stopReason,
      usage: data.usage
        ? { inputTokens: data.usage.prompt_tokens, outputTokens: data.usage.completion_tokens }
        : undefined,
    }
  }

  private toOpenAIMessages(messages: Message[], systemPrompt?: string) {
    const result: Array<Record<string, unknown>> = []

    if (systemPrompt) result.push({ role: 'system', content: systemPrompt })

    for (const m of messages) {
      if (m.role === 'tool_result') {
        result.push({
          role: 'tool',
          tool_call_id: m.toolCallId,
          content: m.content,
        })
      } else {
        result.push({ role: m.role, content: m.content })
      }
    }

    return result
  }

  async ping(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/models`, {
        headers: { Authorization: `Bearer ${this.config.apiKey}` },
      })
      return res.ok
    } catch {
      return false
    }
  }
}

// Groq is OpenAI-compatible
export class GroqAdapter extends OpenAIAdapter {
  constructor(config: { apiKey: string; model: string }) {
    super({ ...config, baseUrl: 'https://api.groq.com/openai/v1' }, 'groq')
  }
}

// Generic OpenAI-compatible (LM Studio, vLLM, Together, Fireworks, etc.)
export class OpenAICompatAdapter extends OpenAIAdapter {
  constructor(config: { apiKey: string; model: string; baseUrl: string }) {
    super(config, 'openai-compat')
  }
}
