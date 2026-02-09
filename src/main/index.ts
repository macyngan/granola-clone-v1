import { app, BrowserWindow, shell, session, desktopCapturer } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { registerIpcHandlers } from './ipc-handlers'
import { setupTray } from './tray'
import { setupMenu } from './menu'
import { initDatabase } from './db'

let mainWindow: BrowserWindow | null = null
let isQuitting = false

// Enable ScreenCaptureKit for system audio loopback on macOS 13+
// This allows capturing system audio without BlackHole
if (process.platform === 'darwin') {
  app.commandLine.appendSwitch('enable-features', 'MacLoopbackAudioForScreenShare,MacSckSystemAudioLoopbackOverride')
}

async function createWindow(): Promise<BrowserWindow> {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    show: false,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 15, y: 15 },
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false // Needed for native modules
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  // Open external links in browser
  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // Hide instead of close (stay in tray)
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault()
      mainWindow?.hide()
    }
  })

  // Set up display media request handler for system audio capture
  mainWindow.webContents.session.setDisplayMediaRequestHandler(
    async (request, callback) => {
      try {
        console.log('Display media requested')
        // Get screen sources
        const sources = await desktopCapturer.getSources({ types: ['screen'] })
        console.log('Screen sources found:', sources.length)

        if (sources.length === 0) {
          console.error('No screen sources available - make sure Screen Recording permission is granted')
          // Return null to indicate denial
          callback({ video: null, audio: null })
          return
        }

        // Grant access to the first screen with loopback audio
        console.log('Granting access to:', sources[0].name, 'with loopback audio')
        callback({
          video: sources[0],
          audio: 'loopback' // This captures system audio on macOS 13+
        })
      } catch (err) {
        console.error('Error in display media handler:', err)
        callback({ video: null, audio: null })
      }
    },
    { useSystemPicker: false }
  )

  // Load the app
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return mainWindow
}

app.whenReady().then(async () => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.granola-clone')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // Initialize database
  await initDatabase()

  // Create the main window
  const window = await createWindow()

  // Register IPC handlers
  registerIpcHandlers(window)

  // Setup system tray
  setupTray(window)

  // Setup application menu
  setupMenu()

  app.on('activate', () => {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    } else {
      mainWindow?.show()
    }
  })
})

// Quit when all windows are closed, except on macOS.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  isQuitting = true
})

// Handle second instance
const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    // Someone tried to run a second instance, focus our window.
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })
}
