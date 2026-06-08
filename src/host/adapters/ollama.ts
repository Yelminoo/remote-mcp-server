import { LLMAdapter, ChatRequest, ChatResponse, ToolCall, Message } from './base.js'

interface OllamaAdapterConfig {
  baseUrl: string
  model: string
  options?: { temperature?: number; num_ctx?: number }
}

interface OllamaMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  tool_calls?: Array<{ function: { name: string; arguments: Record<string, unknown> } }>
}

export class OllamaAdapter implements LLMAdapter {
  readonly name = 'ollama'
  private callIdCounter = 0

  constructor(private config: OllamaAdapterConfig) {}

  async chat(request: ChatRequest): Promise<ChatResponse> {
    const messages = this.toOllamaMessages(request.messages, request.systemPrompt)

    const tools = request.tools.map(t => ({
      type: 'function',
      function: {
        name: t.name,
        description: t.description ?? '',
        parameters: t.inputSchema,
      },
    }))

    const body: Record<string, unknown> = {
      model: this.config.model,
      messages,
      stream: false,
      options: {
        temperature: request.temperature ?? this.config.options?.temperature ?? 0.7,
        num_ctx: this.config.options?.num_ctx ?? 4096,
      },
    }

    if (tools.length > 0) body.tools = tools

    const res = await fetch(`${this.config.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (!res.ok) throw new Error(`Ollama error: ${res.status} ${await res.text()}`)

    const data = await res.json() as {
      message: { content: string; tool_calls?: Array<{ function: { name: string; arguments: Record<string, unknown> } }> }
      done_reason?: string
    }

    const toolCalls: ToolCall[] = (data.message.tool_calls ?? []).map((tc, i) => ({
      id: `ollama-${++this.callIdCounter}-${i}`,
      name: tc.function.name,
      arguments: tc.function.arguments,
    }))

    return {
      content: data.message.content ?? '',
      toolCalls,
      stopReason: toolCalls.length > 0 ? 'tool_use' : 'end_turn',
    }
  }

  private toOllamaMessages(messages: Message[], systemPrompt?: string): OllamaMessage[] {
    const result: OllamaMessage[] = []

    if (systemPrompt) result.push({ role: 'system', content: systemPrompt })

    for (const m of messages) {
      if (m.role === 'system') {
        result.push({ role: 'system', content: m.content })
      } else if (m.role === 'tool_result') {
        result.push({ role: 'tool', content: m.content })
      } else {
        result.push({ role: m.role as 'user' | 'assistant', content: m.content })
      }
    }

    return result
  }

  async ping(): Promise<boolean> {
    try {
      const res = await fetch(`${this.config.baseUrl}/api/tags`)
      return res.ok
    } catch {
      return false
    }
  }
}
