import { useState, useEffect, useCallback, useRef } from 'react'

type AudioSource = 'microphone' | 'system' | 'both'

interface AudioCaptureHook {
  isRecording: boolean
  hasPermission: boolean | null
  audioChunks: Blob[]
  error: string | null
  requestPermissions: () => Promise<boolean>
  startRecording: (source?: AudioSource) => Promise<void>
  stopRecording: () => Promise<Blob | null>
}

export function useAudioCapture(): AudioCaptureHook {
  const [isRecording, setIsRecording] = useState(false)
  const [hasPermission, setHasPermission] = useState<boolean | null>(null)
  const [audioChunks, setAudioChunks] = useState<Blob[]>([])
  const [error, setError] = useState<string | null>(null)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  // Listen for capture commands from main process
  useEffect(() => {
    const cleanupStart = window.electron.onStartCapture(async (source) => {
      try {
        await startCaptureInternal(source as AudioSource)
      } catch (err) {
        window.electron.sendCaptureError((err as Error).message)
      }
    })

    const cleanupStop = window.electron.onStopCapture(async () => {
      try {
        const blob = await stopCaptureInternal()
        if (blob) {
          const buffer = await blob.arrayBuffer()
          window.electron.sendCaptureComplete(Buffer.from(buffer))
        }
      } catch (err) {
        window.electron.sendCaptureError((err as Error).message)
      }
    })

    return () => {
      cleanupStart()
      cleanupStop()
    }
  }, [])

  const requestPermissions = useCallback(async (): Promise<boolean> => {
    try {
      const granted = await window.electron.audio.requestPermissions()
      setHasPermission(granted)
      return granted
    } catch (err) {
      setError((err as Error).message)
      setHasPermission(false)
      return false
    }
  }, [])

  const getMicrophoneStream = async (): Promise<MediaStream> => {
    return navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    })
  }

  const getSystemAudioStream = async (): Promise<MediaStream> => {
    // On macOS, we need to capture from a virtual audio device like BlackHole
    const devices = await navigator.mediaDevices.enumerateDevices()
    const audioInputs = devices.filter((d) => d.kind === 'audioinput')

    // Look for BlackHole or other virtual audio devices
    const virtualDevice = audioInputs.find(
      (d) =>
        d.label.toLowerCase().includes('blackhole') ||
        d.label.toLowerCase().includes('soundflower') ||
        d.label.toLowerCase().includes('loopback')
    )

    if (!virtualDevice) {
      throw new Error(
        'No virtual audio device found. Please install BlackHole:\n' +
          '1. Run: brew install blackhole-2ch\n' +
          '2. Open Audio MIDI Setup\n' +
          '3. Create Multi-Output Device with your speakers + BlackHole\n' +
          '4. Set it as your sound output'
      )
    }

    console.log('Using virtual audio device:', virtualDevice.label)
    return navigator.mediaDevices.getUserMedia({
      audio: {
        deviceId: { exact: virtualDevice.deviceId }
      }
    })
  }

  const getCombinedStream = async (): Promise<MediaStream> => {
    const micStream = await getMicrophoneStream()
    const tracks = [...micStream.getAudioTracks()]

    // Try to get system audio via virtual device
    try {
      const systemStream = await getSystemAudioStream()
      tracks.push(...systemStream.getAudioTracks())
    } catch (err) {
      console.warn('System audio not available, using mic only:', err)
    }

    return new MediaStream(tracks)
  }

  const startCaptureInternal = async (source: AudioSource): Promise<void> => {
    setError(null)
    chunksRef.current = []

    try {
      let stream: MediaStream

      if (source === 'microphone') {
        stream = await getMicrophoneStream()
      } else if (source === 'system') {
        stream = await getSystemAudioStream()
      } else {
        // 'both' - combine microphone and system audio
        stream = await getCombinedStream()
      }

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      })

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data)
          setAudioChunks([...chunksRef.current])
        }
      }

      mediaRecorder.onerror = (event) => {
        setError(`Recording error: ${event}`)
        setIsRecording(false)
      }

      mediaRecorder.start(1000) // Collect data every second
      mediaRecorderRef.current = mediaRecorder
      setIsRecording(true)
    } catch (err) {
      setError((err as Error).message)
      throw err
    }
  }

  const stopCaptureInternal = async (): Promise<Blob | null> => {
    return new Promise((resolve) => {
      const mediaRecorder = mediaRecorderRef.current
      if (!mediaRecorder) {
        resolve(null)
        return
      }

      mediaRecorder.onstop = () => {
        // Stop all tracks
        mediaRecorder.stream.getTracks().forEach((track) => track.stop())

        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        mediaRecorderRef.current = null
        chunksRef.current = []
        setAudioChunks([])
        setIsRecording(false)

        resolve(blob)
      }

      mediaRecorder.stop()
    })
  }

  const startRecording = useCallback(
    async (source: AudioSource = 'microphone'): Promise<void> => {
      if (hasPermission === false) {
        const granted = await requestPermissions()
        if (!granted) {
          throw new Error('Microphone permission denied')
        }
      }

      // Notify main process
      await window.electron.audio.startRecording(source)
    },
    [hasPermission, requestPermissions]
  )

  const stopRecording = useCallback(async (): Promise<Blob | null> => {
    try {
      await window.electron.audio.stopRecording()
      return await stopCaptureInternal()
    } catch (err) {
      setError((err as Error).message)
      return null
    }
  }, [])

  return {
    isRecording,
    hasPermission,
    audioChunks,
    error,
    requestPermissions,
    startRecording,
    stopRecording
  }
}
