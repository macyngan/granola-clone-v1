import { useState, useEffect } from 'react'
import { BarChart3, Star, Clock, Hash } from 'lucide-react'

interface EvaluationStats {
  modelId: string
  modelName: string
  avgRating: number | null
  avgLatency: number | null
  avgTokens: number | null
  count: number
}

interface Evaluation {
  id: string
  taskType: string
  modelId: string
  modelName: string
  input: string
  output: string
  latencyMs: number
  tokensUsed: number
  userRating: number | null
  createdAt: number
}

export function EvaluationsPage() {
  const [stats, setStats] = useState<EvaluationStats[]>([])
  const [evaluations, setEvaluations] = useState<Evaluation[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedModel, setSelectedModel] = useState<string | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      const [statsData, evalsData] = await Promise.all([
        window.electron.db.getEvaluationStats(),
        window.electron.db.getEvaluations({ limit: 50 })
      ])
      setStats(statsData as EvaluationStats[])
      setEvaluations(evalsData as Evaluation[])
    } catch (error) {
      console.error('Failed to load evaluations:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredEvaluations = selectedModel
    ? evaluations.filter((e) => e.modelId === selectedModel)
    : evaluations

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Model Evaluations</h1>
        <p className="text-muted-foreground">Compare model performance and quality</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : stats.length === 0 ? (
        <div className="text-center py-12">
          <BarChart3 className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-lg font-medium mb-2">No evaluations yet</h2>
          <p className="text-muted-foreground">
            Use the AI features to start collecting evaluation data
          </p>
        </div>
      ) : (
        <>
          {/* Stats table */}
          <section className="mb-8">
            <h2 className="text-lg font-semibold mb-4">Model Performance</h2>
            <div className="border border-border rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium">Model</th>
                    <th className="px-4 py-3 text-right text-sm font-medium">
                      <span className="flex items-center justify-end gap-1">
                        <Star className="w-4 h-4" /> Avg Rating
                      </span>
                    </th>
                    <th className="px-4 py-3 text-right text-sm font-medium">
                      <span className="flex items-center justify-end gap-1">
                        <Clock className="w-4 h-4" /> Avg Latency
                      </span>
                    </th>
                    <th className="px-4 py-3 text-right text-sm font-medium">
                      <span className="flex items-center justify-end gap-1">
                        <Hash className="w-4 h-4" /> Avg Tokens
                      </span>
                    </th>
                    <th className="px-4 py-3 text-right text-sm font-medium"># Evals</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {stats.map((stat) => (
                    <tr
                      key={stat.modelId}
                      className="hover:bg-muted/50 cursor-pointer"
                      onClick={() =>
                        setSelectedModel(selectedModel === stat.modelId ? null : stat.modelId)
                      }
                    >
                      <td className="px-4 py-3">
                        <span className="font-medium">{stat.modelName}</span>
                        <span className="text-sm text-muted-foreground ml-2">({stat.modelId})</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {stat.avgRating ? (
                          <span className="flex items-center justify-end gap-1">
                            {stat.avgRating.toFixed(2)}
                            <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {stat.avgLatency ? `${stat.avgLatency.toFixed(0)}ms` : '-'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {stat.avgTokens ? stat.avgTokens.toFixed(0) : '-'}
                      </td>
                      <td className="px-4 py-3 text-right">{stat.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Recent evaluations */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">
                Recent Evaluations
                {selectedModel && (
                  <span className="text-sm font-normal text-muted-foreground ml-2">
                    (filtered by {selectedModel})
                  </span>
                )}
              </h2>
              {selectedModel && (
                <button
                  onClick={() => setSelectedModel(null)}
                  className="text-sm text-primary hover:underline"
                >
                  Clear filter
                </button>
              )}
            </div>

            <div className="space-y-4">
              {filteredEvaluations.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No evaluations found</p>
              ) : (
                filteredEvaluations.map((evaluation) => (
                  <div
                    key={evaluation.id}
                    className="border border-border rounded-lg p-4 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="px-2 py-1 bg-accent rounded text-sm">
                          {evaluation.taskType}
                        </span>
                        <span className="font-medium">{evaluation.modelName}</span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span>{evaluation.latencyMs}ms</span>
                        <span>{evaluation.tokensUsed} tokens</span>
                        {evaluation.userRating && (
                          <span className="flex items-center gap-1">
                            {evaluation.userRating}
                            <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <h4 className="text-sm font-medium mb-1">Input</h4>
                        <div className="text-sm text-muted-foreground bg-muted p-2 rounded max-h-32 overflow-auto">
                          {evaluation.input.substring(0, 200)}
                          {evaluation.input.length > 200 && '...'}
                        </div>
                      </div>
                      <div>
                        <h4 className="text-sm font-medium mb-1">Output</h4>
                        <div className="text-sm text-muted-foreground bg-muted p-2 rounded max-h-32 overflow-auto">
                          {evaluation.output.substring(0, 200)}
                          {evaluation.output.length > 200 && '...'}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </>
      )}
    </div>
  )
}
