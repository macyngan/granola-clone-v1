import React from 'react'
import ReactDOM from 'react-dom/client'
import { RouterProvider, createHashRouter } from 'react-router-dom'
import App from './App'
import { HomePage } from './pages/Home'
import { MeetingPage } from './pages/Meeting'
import { SettingsPage } from './pages/Settings'
import { EvaluationsPage } from './pages/Evaluations'
import './styles/globals.css'

const router = createHashRouter([
  {
    path: '/',
    element: <App />,
    children: [
      {
        index: true,
        element: <HomePage />
      },
      {
        path: 'meeting/new',
        element: <MeetingPage />
      },
      {
        path: 'meeting/:id',
        element: <MeetingPage />
      },
      {
        path: 'settings',
        element: <SettingsPage />
      },
      {
        path: 'evaluations',
        element: <EvaluationsPage />
      }
    ]
  }
])

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
)
