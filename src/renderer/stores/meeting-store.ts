import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface MeetingStore {
  // Active model configurations
  activeLLM: string
  activeSTT: string

  // Set active models
  setActiveLLM: (modelId: string) => void
  setActiveSTT: (sttId: string) => void

  // Current meeting state
  currentMeetingId: string | null
  setCurrentMeetingId: (id: string | null) => void
}

export const useMeetingStore = create<MeetingStore>()(
  persist(
    (set) => ({
      // Default to local models
      activeLLM: 'llama3-8b-local',
      activeSTT: 'whisper-local',

      setActiveLLM: (modelId) => set({ activeLLM: modelId }),
      setActiveSTT: (sttId) => set({ activeSTT: sttId }),

      currentMeetingId: null,
      setCurrentMeetingId: (id) => set({ currentMeetingId: id })
    }),
    {
      name: 'meeting-store'
    }
  )
)
