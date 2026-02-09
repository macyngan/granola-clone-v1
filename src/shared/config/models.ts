import type { AppConfig } from '../types'

// Default configuration with all supported models
export const defaultConfig: AppConfig = {
  activeSTT: 'whisper-local',
  activeLLM: 'llama3-local',

  sttModels: [
    {
      id: 'whisper-local',
      name: 'Whisper (Local)',
      provider: 'faster-whisper',
      modelPath: 'large-v3',
      language: 'en',
      options: {
        device: 'auto', // cpu, cuda, or auto
        computeType: 'float16'
      }
    },
    {
      id: 'whisper-api',
      name: 'OpenAI Whisper API',
      provider: 'whisper-api',
      apiUrl: 'https://api.openai.com/v1/audio/transcriptions',
      apiKey: process.env.OPENAI_API_KEY
    },
    {
      id: 'deepgram',
      name: 'Deepgram',
      provider: 'deepgram',
      apiKey: process.env.DEEPGRAM_API_KEY
    }
  ],

  llmModels: [
    // === LOCAL MODELS (Ollama) ===
    {
      id: 'llama3-local',
      name: 'Llama 3.3 70B (Ollama)',
      provider: 'ollama',
      baseUrl: 'http://localhost:11434',
      model: 'llama3.3:70b',
      maxTokens: 4096,
      temperature: 0.7
    },
    {
      id: 'llama3-8b-local',
      name: 'Llama 3.2 8B (Ollama)',
      provider: 'ollama',
      baseUrl: 'http://localhost:11434',
      model: 'llama3.2:8b',
      maxTokens: 4096,
      temperature: 0.7
    },
    {
      id: 'mistral-local',
      name: 'Mistral 7B (Ollama)',
      provider: 'ollama',
      baseUrl: 'http://localhost:11434',
      model: 'mistral:7b',
      maxTokens: 4096,
      temperature: 0.7
    },
    {
      id: 'qwen-local',
      name: 'Qwen 2.5 32B (Ollama)',
      provider: 'ollama',
      baseUrl: 'http://localhost:11434',
      model: 'qwen2.5:32b',
      maxTokens: 4096,
      temperature: 0.7
    },
    {
      id: 'deepseek-local',
      name: 'DeepSeek R1 (Ollama)',
      provider: 'ollama',
      baseUrl: 'http://localhost:11434',
      model: 'deepseek-r1:32b',
      maxTokens: 4096,
      temperature: 0.7
    },

    // === VLLM MODELS ===
    {
      id: 'llama3-vllm',
      name: 'Llama 3.3 70B (vLLM)',
      provider: 'vllm',
      baseUrl: 'http://localhost:8000',
      model: 'meta-llama/Llama-3.3-70B-Instruct',
      maxTokens: 4096,
      temperature: 0.7
    },

    // === CLOUD MODELS (for comparison) ===
    {
      id: 'gpt-4o',
      name: 'GPT-4o',
      provider: 'openai-compatible',
      baseUrl: 'https://api.openai.com/v1',
      apiKey: process.env.OPENAI_API_KEY,
      model: 'gpt-4o',
      maxTokens: 4096,
      temperature: 0.7
    },
    {
      id: 'claude-sonnet',
      name: 'Claude Sonnet 4',
      provider: 'anthropic',
      baseUrl: 'https://api.anthropic.com',
      apiKey: process.env.ANTHROPIC_API_KEY,
      model: 'claude-sonnet-4-20250514',
      maxTokens: 4096,
      temperature: 0.7
    },
    {
      id: 'groq-llama',
      name: 'Llama 3.3 70B (Groq)',
      provider: 'groq',
      baseUrl: 'https://api.groq.com/openai/v1',
      apiKey: process.env.GROQ_API_KEY,
      model: 'llama-3.3-70b-versatile',
      maxTokens: 4096,
      temperature: 0.7
    }
  ]
}

// Helper to get a model config by ID
export function getModelConfig(modelId: string, config: AppConfig = defaultConfig) {
  return config.llmModels.find((m) => m.id === modelId)
}

// Helper to get STT config by ID
export function getSTTConfig(sttId: string, config: AppConfig = defaultConfig) {
  return config.sttModels.find((m) => m.id === sttId)
}

// Helper to get active LLM config
export function getActiveLLM(config: AppConfig = defaultConfig) {
  return getModelConfig(config.activeLLM, config)
}

// Helper to get active STT config
export function getActiveSTT(config: AppConfig = defaultConfig) {
  return getSTTConfig(config.activeSTT, config)
}
