import { ConnectedServer, connectServer, callTool, ServerDef } from './client.js'
import { ToolSchema, ToolCall } from '../adapters/base.js'

export class McpRegistry {
  private servers: Map<string, ConnectedServer> = new Map()
  private toolTimeout = 30000

  async connectAll(serverDefs: Record<string, ServerDef>, toolTimeout: number): Promise<void> {
    this.toolTimeout = toolTimeout
    const entries = Object.entries(serverDefs)
    if (entries.length === 0) {
      console.log('  (no MCP servers configured)')
      return
    }

    await Promise.allSettled(
      entries.map(async ([name, def]) => {
        try {
          const server = await connectServer(name, def)
          this.servers.set(name, server)
          const toolNames = server.tools.map(t => t.name).join(', ') || 'no tools'
          console.log(`  [ok] ${name} (${server.tools.length} tools: ${toolNames})`)
        } catch (err) {
          console.error(`  [fail] ${name}: ${(err as Error).message}`)
        }
      })
    )
  }

  getAllTools(): ToolSchema[] {
    return [...this.servers.values()].flatMap(s => s.tools)
  }

  async executeTool(toolCall: ToolCall): Promise<string> {
    const server = this.findServerForTool(toolCall.name)
    if (!server) {
      throw new Error(`No server found for tool: ${toolCall.name}`)
    }
    return callTool(server, toolCall.name, toolCall.arguments, this.toolTimeout)
  }

  private findServerForTool(toolName: string): ConnectedServer | undefined {
    for (const server of this.servers.values()) {
      if (server.tools.some(t => t.name === toolName)) {
        return server
      }
    }
    return undefined
  }

  get connectedCount(): number {
    return this.servers.size
  }
}
