#!/usr/bin/env node
import { createInterface } from 'readline'
import { program } from 'commander'
import { loadConfig } from './config/schema.js'
import { buildAdapter } from './factory.js'
import { McpRegistry } from './mcp/registry.js'
import { AgentLoop } from './agent/loop.js'

program
  .name('umcp')
  .description('Universal MCP Host — connect any LLM to any MCP server')
  .option('-c, --config <path>', 'path to config.yaml', 'config.yaml')
  .option('-p, --provider <name>', 'override active provider')
  .option('--model <name>', 'override model name')
  .parse()

const opts = program.opts<{ config: string; provider?: string; model?: string }>()

async function main() {
  console.log('\nUniversal MCP Host\n')

  const config = loadConfig(opts.config)
  const providerName = opts.provider ?? config.provider
  console.log(`Provider: ${providerName}`)

  const adapter = buildAdapter(config, opts.provider)

  const healthy = await adapter.ping()
  if (!healthy) {
    console.error(`Provider "${providerName}" is not reachable. Check your config.`)
    process.exit(1)
  }
  console.log(`Provider OK`)

  console.log('\nMCP servers:')
  const registry = new McpRegistry()
  await registry.connectAll(config.mcpServers as never, config.agent.toolTimeout)
  console.log(`${registry.connectedCount} server(s) connected\n`)

  const agent = new AgentLoop(adapter, registry, {
    systemPrompt: config.agent.systemPrompt,
    maxToolRounds: config.agent.maxToolRounds,
  })

  const allTools = registry.getAllTools()
  if (allTools.length > 0) {
    console.log(`Available tools: ${allTools.map(t => t.name).join(', ')}\n`)
  }

  console.log('Type your message. Commands: /clear (reset history), /tools (list tools), /exit\n')
  console.log('-'.repeat(60))

  const rl = createInterface({ input: process.stdin, output: process.stdout })

  const prompt = () => rl.question('\nYou: ', async (input) => {
    const trimmed = input.trim()

    if (!trimmed) { prompt(); return }

    if (trimmed === '/exit' || trimmed === '/quit') {
      console.log('Goodbye.')
      process.exit(0)
    }

    if (trimmed === '/clear') {
      agent.clearHistory()
      console.log('History cleared.')
      prompt(); return
    }

    if (trimmed === '/tools') {
      const tools = registry.getAllTools()
      if (tools.length === 0) {
        console.log('No tools available.')
      } else {
        tools.forEach(t => console.log(`  ${t.name}: ${t.description ?? '(no description)'}`))
      }
      prompt(); return
    }

    try {
      process.stdout.write('\nAssistant: ')
      const { reply, toolsUsed, rounds } = await agent.run(trimmed)
      console.log(reply)
      if (toolsUsed.length > 0) {
        console.log(`\n[Used ${rounds} tool round(s): ${toolsUsed.join(', ')}]`)
      }
    } catch (err) {
      console.error(`\nError: ${(err as Error).message}`)
    }

    prompt()
  })

  prompt()
}

main().catch(err => {
  console.error('Fatal:', err)
  process.exit(1)
})
