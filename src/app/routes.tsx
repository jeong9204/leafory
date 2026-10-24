import type { RouteObject } from 'react-router'
import { SetupPage } from '../pages/SetupPage'
import { AppLayout } from './AppLayout'

export const routes: RouteObject[] = [
  {
    element: <AppLayout />,
    children: [
      { index: true, element: <SetupPage title="홈" /> },
      { path: 'plants/new', element: <SetupPage title="식물 등록" /> },
      { path: 'plants/:id', element: <SetupPage title="식물 상세" /> },
      {
        path: 'plants/:id/diary/new',
        element: <SetupPage title="일기 작성" />,
      },
      { path: 'records', element: <SetupPage title="기록 목록" /> },
      { path: '*', element: <SetupPage title="페이지를 찾을 수 없습니다" /> },
    ],
  },
]
