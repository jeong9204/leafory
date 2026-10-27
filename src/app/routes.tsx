import type { RouteObject } from 'react-router'
import { SetupPage } from '../pages/SetupPage'
import { PlantDetailPage } from '../pages/PlantDetailPage'
import { HomePage } from '../pages/HomePage'
import { DataFeedback } from '../components/plants/DataFeedback'
import { AppLayout } from './AppLayout'

export const routes: RouteObject[] = [
  {
    element: <AppLayout />,
    hydrateFallbackElement: <DataFeedback />,
    children: [
      { index: true, element: <HomePage /> },
      {
        path: 'plants/new',
        lazy: async () => ({
          Component: (await import('../pages/PlantEditorPage')).PlantEditorPage,
        }),
      },
      {
        path: 'plants/:id/edit',
        lazy: async () => ({
          Component: (await import('../pages/PlantEditorPage')).PlantEditorPage,
        }),
      },
      {
        path: 'plants/:id/care/new',
        lazy: async () => ({
          Component: (await import('../pages/CareEditorPage')).CareEditorPage,
        }),
      },
      {
        path: 'plants/:id/care/:eventId/edit',
        lazy: async () => ({
          Component: (await import('../pages/CareEditorPage')).CareEditorPage,
        }),
      },
      { path: 'plants/:id', element: <PlantDetailPage /> },
      {
        path: 'plants/:id/diary/new',
        lazy: async () => ({
          Component: (await import('../pages/DiaryEditorPage')).DiaryEditorPage,
        }),
      },
      {
        path: 'plants/:id/diary/:entryId',
        lazy: async () => ({
          Component: (await import('../pages/DiaryDetailPage')).DiaryDetailPage,
        }),
      },
      {
        path: 'plants/:id/diary/:entryId/edit',
        lazy: async () => ({
          Component: (await import('../pages/DiaryEditorPage')).DiaryEditorPage,
        }),
      },
      {
        path: 'backup',
        lazy: async () => ({
          Component: (await import('../pages/BackupPage')).BackupPage,
        }),
      },
      {
        path: 'calendar',
        lazy: async () => ({
          Component: (await import('../pages/CalendarPage')).CalendarPage,
        }),
      },
      {
        path: 'install',
        lazy: async () => ({
          Component: (await import('../pages/InstallPage')).InstallPage,
        }),
      },
      { path: 'records', element: <SetupPage title="기록 목록" /> },
      { path: '*', element: <SetupPage title="페이지를 찾을 수 없습니다" /> },
    ],
  },
]
