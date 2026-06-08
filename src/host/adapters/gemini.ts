import { LLMAdapter, ChatRequest, ChatResponse, ToolCall, Message } from './base.js'

interface GeminiAdapterConfig {
  apiKey: string
  model: string
}

export class GeminiAdapter implements LLMAdapter {
  readonly name = 'gemini'
  private callIdCounter = 0

  constructor(private config: GeminiAdapterConfig) {}

  async chat(request: ChatRequest): Promise<ChatResponse> {
    const contents = this.toGeminiContents(request.messages)

    const tools = request.tools.length > 0
      ? [{
        functionDeclarations: request.tools.map(t => ({
          name: t.name,
          description: t.description ?? '',
          parameters: this.sanitizeSchema(t.inputSchema),
        })),
      }]
      : undefined

    const body: Record<string, unknown> = {
      contents,
      generationConfig: {
        temperature: request.temperature ?? 0.7,
        maxOutputTokens: request.maxTokens ?? 4096,
      },
    }

    if (request.systemPrompt) {
      body.systemInstruction = { parts: [{ text: request.systemPrompt }] }
    }

    if (tools) body.tools = tools

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.config.model}:generateContent?key=${this.config.apiKey}`

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (!res.ok) throw new Error(`Gemini error: ${res.status} ${await res.text()}`)

    const data = await res.json() as {
      candidates: Array<{
        content: {
          parts: Array<
            | { text: string }
            | { functionCall: { name: string; args: Record<string, unknown> } }
          >
        }
        finishReason: string
      }>
      usageMetadata?: { promptTokenCount: number; candidatesTokenCount: number }
    }

    const parts = data.candidates[0]?.content?.parts ?? []

    const textContent = parts
      .filter((p): p is { text: string } => 'text' in p)
      .map(p => p.text)
      .join('')

    const toolCalls: ToolCall[] = parts
      .filter((p): p is { functionCall: { name: string; args: Record<string, unknown> } } => 'functionCall' in p)
      .map(p => ({
        id: `gemini-${++this.callIdCounter}`,
        name: p.functionCall.name,
        arguments: p.functionCall.args,
      }))

    return {
      content: textContent,
      toolCalls,
      stopReason: toolCalls.length > 0 ? 'tool_use' : 'end_turn',
      usage: data.usageMetadata
        ? {
          inputTokens: data.usageMetadata.promptTokenCount,
          outputTokens: data.usageMetadata.candidatesTokenCount,
        }
        : undefined,
    }
  }

  // Gemini rejects additionalProperties and $schema — strip them
  private sanitizeSchema(schema: Record<string, unknown>): Record<string, unknown> {
    const { $schema, additionalProperties, ...rest } = schema as Record<string, unknown>
    void $schema; void additionalProperties
    if (rest.properties && typeof rest.properties === 'object') {
      rest.properties = Object.fromEntries(
        Object.entries(rest.properties as Record<string, unknown>).map(([k, v]) => [
          k,
          this.sanitizeSchema(v as Record<string, unknown>),
        ])
      )
    }
    return rest
  }

  private toGeminiContents(messages: Message[]) {
    return messages
      .filter(m => m.role !== 'system')
      .map(m => {
        if (m.role === 'tool_result') {
          return {
            role: 'user',
            parts: [{
              functionResponse: {
                name: m.toolName ?? 'unknown',
                response: { content: m.content },
              },
            }],
          }
        }
        return {
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }],
        }
      })
  }

  async ping(): Promise<boolean> {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${this.config.apiKey}`
      )
      return res.ok
    } catch {
      return false
    }
  }
}
