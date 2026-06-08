import { LLMAdapter } from './adapters/base.js'
import { OllamaAdapter } from './adapters/ollama.js'
import { OpenAIAdapter, GroqAdapter, OpenAICompatAdapter } from './adapters/openai.js'
import { AnthropicAdapter } from './adapters/anthropic.js'
import { GeminiAdapter } from './adapters/gemini.js'
import { Config } from './config/schema.js'

export function buildAdapter(config: Config, providerOverride?: string): LLMAdapter {
  const provider = providerOverride ?? config.provider
  const providers = config.providers ?? {}

  switch (provider) {
    case 'ollama': {
      const c = providers.ollama
      if (!c) throw new Error('No ollama config found in providers')
      return new OllamaAdapter({ baseUrl: c.baseUrl, model: c.model, options: c.options })
    }

    case 'openai': {
      const c = providers.openai
      if (!c) throw new Error('No openai config found in providers')
      return new OpenAIAdapter({ apiKey: c.apiKey, model: c.model, options: c.options })
    }

    case 'anthropic': {
      const c = providers.anthropic
      if (!c) throw new Error('No anthropic config found in providers')
      return new AnthropicAdapter({ apiKey: c.apiKey, model: c.model, options: c.options })
    }

    case 'groq': {
      const c = providers.groq
      if (!c) throw new Error('No groq config found in providers')
      return new GroqAdapter({ apiKey: c.apiKey, model: c.model })
    }

    case 'gemini': {
      const c = providers.gemini
      if (!c) throw new Error('No gemini config found in providers')
      return new GeminiAdapter({ apiKey: c.apiKey, model: c.model })
    }

    case 'openai-compat': {
      const c = providers['openai-compat']
      if (!c) throw new Error('No openai-compat config found in providers')
      if (!c.baseUrl) throw new Error('openai-compat requires a baseUrl')
      return new OpenAICompatAdapter({ apiKey: c.apiKey, model: c.model, baseUrl: c.baseUrl })
    }

    default:
      throw new Error(`Unknown provider: ${provider}`)
  }
}
