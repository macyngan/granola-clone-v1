import type { ModelConfig, ChatMessage, LLMResponse } from '@shared/types'

export async function callLLM(config: ModelConfig, messages: ChatMessage[]): Promise<LLMResponse> {
  const startTime = Date.now()

  switch (config.provider) {
    case 'ollama':
      return callOllama(config, messages, startTime)
    case 'vllm':
    case 'openai-compatible':
    case 'groq':
      return callOpenAICompatible(config, messages, startTime)
    case 'anthropic':
      return callAnthropic(config, messages, startTime)
    default:
      throw new Error(`Unknown provider: ${config.provider}`)
  }
}

async function callOllama(
  config: ModelConfig,
  messages: ChatMessage[],
  startTime: number
): Promise<LLMResponse> {
  const response = await fetch(`${config.baseUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: config.model,
      messages,
      options: {
        temperature: config.temperature,
        num_predict: config.maxTokens
      },
      stream: false
    })
  })

  if (!response.ok) {
    throw new Error(`Ollama error: ${response.status} ${response.statusText}`)
  }

  const data = await response.json()

  return {
    content: data.message.content,
    model: config.model,
    usage: data.eval_count
      ? {
          promptTokens: data.prompt_eval_count || 0,
          completionTokens: data.eval_count,
          totalTokens: (data.prompt_eval_count || 0) + data.eval_count
        }
      : undefined,
    latencyMs: Date.now() - startTime
  }
}

async function callOpenAICompatible(
  config: ModelConfig,
  messages: ChatMessage[],
  startTime: number
): Promise<LLMResponse> {
  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(config.apiKey && { Authorization: `Bearer ${config.apiKey}` })
    },
    body: JSON.stringify({
      model: config.model,
      messages,
      max_tokens: config.maxTokens,
      temperature: config.temperature
    })
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`API error: ${response.status} ${errorText}`)
  }

  const data = await response.json()

  return {
    content: data.choices[0].message.content,
    model: config.model,
    usage: data.usage
      ? {
          promptTokens: data.usage.prompt_tokens,
          completionTokens: data.usage.completion_tokens,
          totalTokens: data.usage.total_tokens
        }
      : undefined,
    latencyMs: Date.now() - startTime
  }
}

async function callAnthropic(
  config: ModelConfig,
  messages: ChatMessage[],
  startTime: number
): Promise<LLMResponse> {
  // Extract system message
  const systemMsg = messages.find((m) => m.role === 'system')
  const chatMessages = messages.filter((m) => m.role !== 'system')

  const response = await fetch(`${config.baseUrl}/v1/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.apiKey!,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: config.maxTokens,
      system: systemMsg?.content,
      messages: chatMessages.map((m) => ({
        role: m.role,
        content: m.content
      }))
    })
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Anthropic error: ${response.status} ${errorText}`)
  }

  const data = await response.json()

  return {
    content: data.content[0].text,
    model: config.model,
    usage: {
      promptTokens: data.usage.input_tokens,
      completionTokens: data.usage.output_tokens,
      totalTokens: data.usage.input_tokens + data.usage.output_tokens
    },
    latencyMs: Date.now() - startTime
  }
}

// Streaming version for real-time UI updates
export async function* streamLLM(
  config: ModelConfig,
  messages: ChatMessage[]
): AsyncGenerator<string> {
  switch (config.provider) {
    case 'ollama':
      yield* streamOllama(config, messages)
      break
    case 'vllm':
    case 'openai-compatible':
    case 'groq':
      yield* streamOpenAICompatible(config, messages)
      break
    case 'anthropic':
      yield* streamAnthropic(config, messages)
      break
    default:
      throw new Error(`Unknown provider: ${config.provider}`)
  }
}

async function* streamOllama(
  config: ModelConfig,
  messages: ChatMessage[]
): AsyncGenerator<string> {
  const response = await fetch(`${config.baseUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: config.model,
      messages,
      options: {
        temperature: config.temperature,
        num_predict: config.maxTokens
      },
      stream: true
    })
  })

  if (!response.ok) {
    throw new Error(`Ollama error: ${response.status}`)
  }

  const reader = response.body?.getReader()
  if (!reader) throw new Error('No response body')

  const decoder = new TextDecoder()

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    const text = decoder.decode(value)
    const lines = text.split('\n').filter((line) => line.trim())

    for (const line of lines) {
      try {
        const data = JSON.parse(line)
        if (data.message?.content) {
          yield data.message.content
        }
      } catch {
        // Skip invalid JSON
      }
    }
  }
}

async function* streamOpenAICompatible(
  config: ModelConfig,
  messages: ChatMessage[]
): AsyncGenerator<string> {
  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(config.apiKey && { Authorization: `Bearer ${config.apiKey}` })
    },
    body: JSON.stringify({
      model: config.model,
      messages,
      max_tokens: config.maxTokens,
      temperature: config.temperature,
      stream: true
    })
  })

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`)
  }

  const reader = response.body?.getReader()
  if (!reader) throw new Error('No response body')

  const decoder = new TextDecoder()

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    const text = decoder.decode(value)
    const lines = text.split('\n').filter((line) => line.startsWith('data: '))

    for (const line of lines) {
      const data = line.slice(6)
      if (data === '[DONE]') continue

      try {
        const parsed = JSON.parse(data)
        const content = parsed.choices?.[0]?.delta?.content
        if (content) {
          yield content
        }
      } catch {
        // Skip invalid JSON
      }
    }
  }
}

async function* streamAnthropic(
  config: ModelConfig,
  messages: ChatMessage[]
): AsyncGenerator<string> {
  const systemMsg = messages.find((m) => m.role === 'system')
  const chatMessages = messages.filter((m) => m.role !== 'system')

  const response = await fetch(`${config.baseUrl}/v1/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.apiKey!,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: config.maxTokens,
      system: systemMsg?.content,
      messages: chatMessages.map((m) => ({
        role: m.role,
        content: m.content
      })),
      stream: true
    })
  })

  if (!response.ok) {
    throw new Error(`Anthropic error: ${response.status}`)
  }

  const reader = response.body?.getReader()
  if (!reader) throw new Error('No response body')

  const decoder = new TextDecoder()

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    const text = decoder.decode(value)
    const lines = text.split('\n').filter((line) => line.startsWith('data: '))

    for (const line of lines) {
      try {
        const data = JSON.parse(line.slice(6))
        if (data.type === 'content_block_delta' && data.delta?.text) {
          yield data.delta.text
        }
      } catch {
        // Skip invalid JSON
      }
    }
  }
}
