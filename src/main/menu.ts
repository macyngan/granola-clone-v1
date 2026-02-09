import { Menu, shell, app, BrowserWindow } from 'electron'
import { is } from '@electron-toolkit/utils'

export function setupMenu(): void {
  const isMac = process.platform === 'darwin'

  const template: Electron.MenuItemConstructorOptions[] = [
    // App menu (macOS only)
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: 'about' as const },
              { type: 'separator' as const },
              {
                label: 'Settings',
                accelerator: 'Cmd+,',
                click: (): void => {
                  const win = BrowserWindow.getFocusedWindow()
                  win?.webContents.send('navigate', '/settings')
                }
              },
              { type: 'separator' as const },
              { role: 'services' as const },
              { type: 'separator' as const },
              { role: 'hide' as const },
              { role: 'hideOthers' as const },
              { role: 'unhide' as const },
              { type: 'separator' as const },
              { role: 'quit' as const }
            ]
          }
        ]
      : []),

    // File menu
    {
      label: 'File',
      submenu: [
        {
          label: 'New Meeting',
          accelerator: 'CmdOrCtrl+N',
          click: (): void => {
            const win = BrowserWindow.getFocusedWindow()
            win?.webContents.send('navigate', '/meeting/new')
          }
        },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' }
      ]
    },

    // Edit menu
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        ...(isMac
          ? [
              { role: 'pasteAndMatchStyle' as const },
              { role: 'delete' as const },
              { role: 'selectAll' as const }
            ]
          : [{ role: 'delete' as const }, { type: 'separator' as const }, { role: 'selectAll' as const }])
      ]
    },

    // View menu
    {
      label: 'View',
      submenu: [
        ...(is.dev
          ? [
              { role: 'reload' as const },
              { role: 'forceReload' as const },
              { role: 'toggleDevTools' as const },
              { type: 'separator' as const }
            ]
          : []),
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },

    // Recording menu
    {
      label: 'Recording',
      submenu: [
        {
          label: 'Start Recording',
          accelerator: 'CmdOrCtrl+R',
          click: (): void => {
            const win = BrowserWindow.getFocusedWindow()
            win?.webContents.send('tray:toggle-recording')
          }
        },
        {
          label: 'Stop Recording',
          accelerator: 'CmdOrCtrl+Shift+R',
          click: (): void => {
            const win = BrowserWindow.getFocusedWindow()
            win?.webContents.send('tray:toggle-recording')
          }
        }
      ]
    },

    // Window menu
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        ...(isMac
          ? [{ type: 'separator' as const }, { role: 'front' as const }, { type: 'separator' as const }, { role: 'window' as const }]
          : [{ role: 'close' as const }])
      ]
    },

    // Help menu
    {
      role: 'help',
      submenu: [
        {
          label: 'Learn More',
          click: async (): Promise<void> => {
            await shell.openExternal('https://github.com/your-repo/granola-clone')
          }
        },
        {
          label: 'Report Issue',
          click: async (): Promise<void> => {
            await shell.openExternal('https://github.com/your-repo/granola-clone/issues')
          }
        }
      ]
    }
  ]

  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
}
