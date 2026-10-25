import { RouterProvider } from 'react-router'
import type { createBrowserRouter } from 'react-router'

export default function App({
  router,
}: {
  router: ReturnType<typeof createBrowserRouter>
}) {
  return <RouterProvider router={router} />
}
