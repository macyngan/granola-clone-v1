import { useState, useEffect } from 'react'
import { Check, X, Loader2, RefreshCw } from 'lucide-react'
import { useMeetingStore } from '../stores/meeting-store'
import { cn } from '../lib/utils'
import type { ModelConfig } from '@shared/types'

export function SettingsPage() {
  const [models, setModels] = useState<ModelConfig[]>([])
  const [testResults, setTestResults] = useState<
    Record<string, { success: boolean; latencyMs?: number; error?: string } | 'testing'>
  >({})

  const { activeLLM, activeSTT, setActiveLLM, setActiveSTT } = useMeetingStore()

  useEffect(() => {
    loadModels()
  }, [])

  async function loadModels() {
    try {
      const data = await window.electron.llm.getModels()
      setModels(data)
    } catch (error) {
      console.error('Failed to load models:', error)
    }
  }

  async function testModel(modelId: string) {
    setTestResults((prev) => ({ ...prev, [modelId]: 'testing' }))

    try {
      const result = await window.electron.llm.testConnection(modelId)
      setTestResults((prev) => ({ ...prev, [modelId]: result }))
    } catch (error) {
      setTestResults((prev) => ({
        ...prev,
        [modelId]: { success: false, error: (error as Error).message }
      }))
    }
  }

  const groupedModels = models.reduce(
    (acc, model) => {
      const group = model.provider
      if (!acc[group]) acc[group] = []
      acc[group].push(model)
      return acc
    },
    {} as Record<string, ModelConfig[]>
  )

  const providerLabels: Record<string, string> = {
    ollama: 'Ollama (Local)',
    vllm: 'vLLM (Local)',
    'openai-compatible': 'OpenAI',
    anthropic: 'Anthropic',
    groq: 'Groq'
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">Settings</h1>
      <p className="text-muted-foreground mb-8">Configure AI models and preferences</p>

      {/* LLM Settings */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-4">Language Models (LLM)</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Select the model to use for note enhancement and chat
        </p>

        <div className="space-y-6">
          {Object.entries(groupedModels).map(([provider, providerModels]) => (
            <div key={provider}>
              <h3 className="text-sm font-medium text-muted-foreground mb-2">
                {providerLabels[provider] || provider}
              </h3>
              <div className="space-y-2">
                {providerModels.map((model) => {
                  const testResult = testResults[model.id]
                  const isActive = activeLLM === model.id

                  return (
                    <div
                      key={model.id}
                      className={cn(
                        'flex items-center gap-4 p-4 border rounded-lg transition-colors',
                        isActive ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                      )}
                    >
                      <button
                        onClick={() => setActiveLLM(model.id)}
                        className="flex-1 text-left"
                      >
                        <div className="flex items-center gap-2">
                          <div
                            className={cn(
                              'w-3 h-3 rounded-full border-2',
                              isActive
                                ? 'border-primary bg-primary'
                                : 'border-muted-foreground'
                            )}
                          />
                          <span className="font-medium">{model.name}</span>
                          {isActive && (
                            <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded">
                              Active
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground ml-5 mt-1">
                          {model.model} • {model.baseUrl}
                        </div>
                      </button>

                      <div className="flex items-center gap-2">
                        {testResult === 'testing' ? (
                          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                        ) : testResult ? (
                          testResult.success ? (
                            <span className="flex items-center gap-1 text-sm text-green-600">
                              <Check className="w-4 h-4" />
                              {testResult.latencyMs}ms
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-sm text-red-600">
                              <X className="w-4 h-4" />
                              Failed
                            </span>
                          )
                        ) : null}

                        <button
                          onClick={() => testModel(model.id)}
                          className="p-2 hover:bg-accent rounded-lg transition-colors"
                          title="Test connection"
                        >
                          <RefreshCw className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* STT Settings */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-4">Speech-to-Text (STT)</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Select the model to use for transcription
        </p>

        <div className="space-y-2">
          {[
            { id: 'whisper-local', name: 'Whisper (Local)', description: 'faster-whisper with large-v3 model' },
            { id: 'whisper-api', name: 'OpenAI Whisper API', description: 'Requires API key' },
            { id: 'deepgram', name: 'Deepgram', description: 'Real-time streaming transcription' }
          ].map((stt) => {
            const isActive = activeSTT === stt.id

            return (
              <button
                key={stt.id}
                onClick={() => setActiveSTT(stt.id)}
                className={cn(
                  'w-full flex items-center gap-4 p-4 border rounded-lg text-left transition-colors',
                  isActive ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                )}
              >
                <div
                  className={cn(
                    'w-3 h-3 rounded-full border-2',
                    isActive ? 'border-primary bg-primary' : 'border-muted-foreground'
                  )}
                />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{stt.name}</span>
                    {isActive && (
                      <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded">
                        Active
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground">{stt.description}</div>
                </div>
              </button>
            )
          })}
        </div>
      </section>

      {/* About */}
      <section>
        <h2 className="text-lg font-semibold mb-4">About</h2>
        <div className="text-sm text-muted-foreground space-y-1">
          <p>Granola Clone v0.1.0</p>
          <p>AI-powered meeting notes application</p>
        </div>
      </section>
    </div>
  )
}
