import type { RouteObject } from 'react-router'
import { SetupPage } from '../pages/SetupPage'
import { PlantDetailPage } from '../pages/PlantDetailPage'
import { PlantEditorPage } from '../pages/PlantEditorPage'
import { CareEditorPage } from '../pages/CareEditorPage'
import { HomePage } from '../pages/HomePage'
import { DiaryEditorPage } from '../pages/DiaryEditorPage'
import { DiaryDetailPage } from '../pages/DiaryDetailPage'
import { AppLayout } from './AppLayout'

export const routes: RouteObject[] = [
  {
    element: <AppLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'plants/new', element: <PlantEditorPage /> },
      { path: 'plants/:id/edit', element: <PlantEditorPage /> },
      { path: 'plants/:id/care/new', element: <CareEditorPage /> },
      { path: 'plants/:id/care/:eventId/edit', element: <CareEditorPage /> },
      { path: 'plants/:id', element: <PlantDetailPage /> },
      {
        path: 'plants/:id/diary/new',
        element: <DiaryEditorPage />,
      },
      { path: 'plants/:id/diary/:entryId', element: <DiaryDetailPage /> },
      { path: 'plants/:id/diary/:entryId/edit', element: <DiaryEditorPage /> },
      { path: 'records', element: <SetupPage title="기록 목록" /> },
      { path: '*', element: <SetupPage title="페이지를 찾을 수 없습니다" /> },
    ],
  },
]
