import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js'
import { ToolSchema } from '../adapters/base.js'

export interface ConnectedServer {
  name: string
  client: Client
  tools: ToolSchema[]
}

interface StdioServerDef {
  command: string
  args?: string[]
  env?: Record<string, string>
}

interface HttpServerDef {
  type: 'http'
  url: string
  headers?: Record<string, string>
}

export type ServerDef = StdioServerDef | HttpServerDef

export async function connectServer(name: string, def: ServerDef): Promise<ConnectedServer> {
  const client = new Client({ name: 'universal-mcp-host', version: '1.0.0' })

  if ('type' in def && def.type === 'http') {
    // Try Streamable HTTP first, fall back to SSE
    try {
      const transport = new StreamableHTTPClientTransport(new URL(def.url))
      await client.connect(transport)
    } catch {
      console.warn(`  [warn] ${name}: Streamable HTTP failed, falling back to SSE`)
      const sseTransport = new SSEClientTransport(new URL(def.url))
      await client.connect(sseTransport)
    }
  } else {
    const stdio = def as StdioServerDef
    const transport = new StdioClientTransport({
      command: stdio.command,
      args: stdio.args ?? [],
      env: { ...process.env, ...(stdio.env ?? {}) } as Record<string, string>,
    })
    await client.connect(transport)
  }

  const toolsResult = await client.listTools()
  const tools: ToolSchema[] = toolsResult.tools.map(t => ({
    name: t.name,
    description: t.description,
    inputSchema: t.inputSchema as Record<string, unknown>,
  }))

  return { name, client, tools }
}

export async function callTool(
  server: ConnectedServer,
  toolName: string,
  args: Record<string, unknown>,
  timeoutMs: number
): Promise<string> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`Tool ${toolName} timed out after ${timeoutMs}ms`)), timeoutMs)
  )

  const call = server.client.callTool({ name: toolName, arguments: args })

  const result = await Promise.race([call, timeout]) as {
    content: Array<{ type: string; text?: string }>
    isError?: boolean
  }

  if (result.isError) {
    throw new Error(`Tool ${toolName} returned an error: ${JSON.stringify(result.content)}`)
  }

  return result.content
    .filter(c => c.type === 'text' && c.text)
    .map(c => c.text!)
    .join('\n')
}
