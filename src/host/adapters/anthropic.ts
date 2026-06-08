import { LLMAdapter, ChatRequest, ChatResponse, ToolCall, Message } from './base.js'

interface AnthropicAdapterConfig {
  apiKey: string
  model: string
  options?: { maxTokens?: number; temperature?: number }
}

export class AnthropicAdapter implements LLMAdapter {
  readonly name = 'anthropic'

  constructor(private config: AnthropicAdapterConfig) {}

  async chat(request: ChatRequest): Promise<ChatResponse> {
    const messages = this.toAnthropicMessages(request.messages)

    const tools = request.tools.map(t => ({
      name: t.name,
      description: t.description ?? '',
      input_schema: t.inputSchema,
    }))

    const body: Record<string, unknown> = {
      model: this.config.model,
      max_tokens: request.maxTokens ?? this.config.options?.maxTokens ?? 4096,
      messages,
      system: request.systemPrompt ?? 'You are a helpful assistant.',
    }

    if (request.temperature !== undefined) body.temperature = request.temperature
    if (tools.length > 0) body.tools = tools

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.config.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    })

    if (!res.ok) throw new Error(`Anthropic error: ${res.status} ${await res.text()}`)

    const data = await res.json() as {
      content: Array<
        | { type: 'text'; text: string }
        | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
      >
      stop_reason: string
      usage: { input_tokens: number; output_tokens: number }
    }

    const textContent = data.content
      .filter((b): b is { type: 'text'; text: string } => b.type === 'text')
      .map(b => b.text)
      .join('')

    const toolCalls: ToolCall[] = data.content
      .filter((b): b is { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> } => b.type === 'tool_use')
      .map(b => ({ id: b.id, name: b.name, arguments: b.input }))

    const stopReason =
      data.stop_reason === 'tool_use' ? 'tool_use' as const
      : data.stop_reason === 'max_tokens' ? 'max_tokens' as const
      : 'end_turn' as const

    return {
      content: textContent,
      toolCalls,
      stopReason,
      usage: {
        inputTokens: data.usage.input_tokens,
        outputTokens: data.usage.output_tokens,
      },
    }
  }

  private toAnthropicMessages(messages: Message[]) {
    const result: Array<Record<string, unknown>> = []

    for (const m of messages) {
      if (m.role === 'system') continue

      if (m.role === 'tool_result') {
        result.push({
          role: 'user',
          content: [{
            type: 'tool_result',
            tool_use_id: m.toolCallId,
            content: m.content,
          }],
        })
      } else {
        result.push({ role: m.role, content: m.content })
      }
    }

    return result
  }

  async ping(): Promise<boolean> {
    try {
      const res = await fetch('https://api.anthropic.com/v1/models', {
        headers: {
          'x-api-key': this.config.apiKey,
          'anthropic-version': '2023-06-01',
        },
      })
      return res.ok
    } catch {
      return false
    }
  }
}
