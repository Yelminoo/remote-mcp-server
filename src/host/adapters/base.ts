// Shared types across all LLM adapters

export interface ToolSchema {
  name: string
  description?: string
  inputSchema: Record<string, unknown>
}

export interface ToolCall {
  id: string
  name: string
  arguments: Record<string, unknown>
}

export type MessageRole = 'user' | 'assistant' | 'tool_result' | 'system'

export interface Message {
  role: MessageRole
  content: string
  toolCallId?: string
  toolName?: string
}

export interface ChatRequest {
  messages: Message[]
  tools: ToolSchema[]
  systemPrompt?: string
  temperature?: number
  maxTokens?: number
}

export interface TokenUsage {
  inputTokens?: number
  outputTokens?: number
}

export interface ChatResponse {
  content: string
  toolCalls: ToolCall[]
  stopReason: 'end_turn' | 'tool_use' | 'max_tokens' | 'error'
  usage?: TokenUsage
}

export interface LLMAdapter {
  readonly name: string
  chat(request: ChatRequest): Promise<ChatResponse>
  ping(): Promise<boolean>
}
