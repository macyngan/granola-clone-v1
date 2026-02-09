import { Tray, Menu, nativeImage, BrowserWindow, app } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'

let tray: Tray | null = null
let isRecording = false

export function setupTray(mainWindow: BrowserWindow): Tray {
  // Create a simple tray icon (16x16 works best for system tray)
  const iconPath = is.dev
    ? join(__dirname, '../../resources/tray-icon.png')
    : join(process.resourcesPath, 'tray-icon.png')

  // Create a fallback icon if the file doesn't exist
  let icon: Electron.NativeImage
  try {
    icon = nativeImage.createFromPath(iconPath)
    if (icon.isEmpty()) {
      icon = createDefaultIcon()
    }
  } catch {
    icon = createDefaultIcon()
  }

  tray = new Tray(icon.resize({ width: 16, height: 16 }))
  tray.setToolTip('Granola Clone')

  const updateMenu = (): void => {
    const contextMenu = Menu.buildFromTemplate([
      {
        label: isRecording ? '⏹ Stop Recording' : '⏺ Start Recording',
        click: (): void => {
          mainWindow.webContents.send('tray:toggle-recording')
        }
      },
      { type: 'separator' },
      {
        label: 'Open Granola',
        click: (): void => mainWindow.show()
      },
      {
        label: 'New Meeting',
        click: (): void => {
          mainWindow.show()
          mainWindow.webContents.send('navigate', '/meeting/new')
        }
      },
      { type: 'separator' },
      {
        label: 'Settings',
        click: (): void => {
          mainWindow.show()
          mainWindow.webContents.send('navigate', '/settings')
        }
      },
      { type: 'separator' },
      {
        label: 'Quit',
        click: (): void => {
          // Force quit - app.on('before-quit') will set isQuitting flag
          app.quit()
        }
      }
    ])

    tray?.setContextMenu(contextMenu)
  }

  updateMenu()

  tray.on('click', () => {
    if (mainWindow.isVisible()) {
      mainWindow.hide()
    } else {
      mainWindow.show()
    }
  })

  // Listen for recording state changes
  mainWindow.webContents.on('ipc-message', (_, channel, ...args) => {
    if (channel === 'recording-state-changed') {
      isRecording = args[0] as boolean
      updateTrayIcon()
      updateMenu()
    }
  })

  return tray
}

function updateTrayIcon(): void {
  if (!tray) return

  const icon = isRecording ? createRecordingIcon() : createDefaultIcon()
  tray.setImage(icon.resize({ width: 16, height: 16 }))
}

function createDefaultIcon(): Electron.NativeImage {
  // Create a simple gray circle icon
  const size = 32
  const canvas = `
    <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2 - 2}" fill="#666" stroke="#333" stroke-width="2"/>
    </svg>
  `
  return nativeImage.createFromBuffer(Buffer.from(canvas))
}

function createRecordingIcon(): Electron.NativeImage {
  // Create a red circle icon for recording state
  const size = 32
  const canvas = `
    <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2 - 2}" fill="#ef4444" stroke="#dc2626" stroke-width="2"/>
    </svg>
  `
  return nativeImage.createFromBuffer(Buffer.from(canvas))
}

export function getTray(): Tray | null {
  return tray
}
