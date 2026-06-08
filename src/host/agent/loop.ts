import { LLMAdapter, Message, ToolCall } from '../adapters/base.js'
import { McpRegistry } from '../mcp/registry.js'

interface AgentConfig {
  systemPrompt: string
  maxToolRounds: number
}

export interface AgentTurn {
  reply: string
  toolsUsed: string[]
  rounds: number
}

export class AgentLoop {
  private history: Message[] = []

  constructor(
    private adapter: LLMAdapter,
    private registry: McpRegistry,
    private config: AgentConfig
  ) {}

  async run(userMessage: string): Promise<AgentTurn> {
    this.history.push({ role: 'user', content: userMessage })

    const toolsUsed: string[] = []
    let rounds = 0

    while (rounds < this.config.maxToolRounds) {
      const tools = this.registry.getAllTools()

      const response = await this.adapter.chat({
        messages: [...this.history],
        tools,
        systemPrompt: this.config.systemPrompt,
      })

      if (response.stopReason !== 'tool_use' || response.toolCalls.length === 0) {
        this.history.push({ role: 'assistant', content: response.content })
        return { reply: response.content, toolsUsed, rounds }
      }

      rounds++

      this.history.push({
        role: 'assistant',
        content: response.content || `[calling: ${response.toolCalls.map(t => t.name).join(', ')}]`,
      })

      const results = await Promise.allSettled(
        response.toolCalls.map(tc => this.executeToolCall(tc))
      )

      for (let i = 0; i < response.toolCalls.length; i++) {
        const tc = response.toolCalls[i]
        const result = results[i]
        const content = result.status === 'fulfilled'
          ? result.value
          : `Error: ${(result.reason as Error).message}`

        toolsUsed.push(tc.name)

        this.history.push({
          role: 'tool_result',
          content,
          toolCallId: tc.id,
          toolName: tc.name,
        })
      }
    }

    const safetyMsg = `[Reached max tool rounds (${this.config.maxToolRounds}). Stopping.]`
    this.history.push({ role: 'assistant', content: safetyMsg })
    return { reply: safetyMsg, toolsUsed, rounds }
  }

  private async executeToolCall(tc: ToolCall): Promise<string> {
    console.log(`  -> ${tc.name}(${JSON.stringify(tc.arguments)})`)
    const result = await this.registry.executeTool(tc)
    console.log(`  <- ${tc.name}: ${result.slice(0, 120)}${result.length > 120 ? '...' : ''}`)
    return result
  }

  clearHistory(): void {
    this.history = []
  }

  getHistory(): Message[] {
    return [...this.history]
  }
}
