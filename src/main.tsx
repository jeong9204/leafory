import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter } from 'react-router'
import 'pretendard/dist/web/variable/pretendardvariable.css'
import './index.css'
import App from './App'
import { routes } from './app/routes'
import { LeaforyDatabase } from './data/local/database'
import { createLocalRepositories } from './data/local/repositories'
import { RepositoryProvider } from './app/RepositoryProvider'
import './pages/plant-management.css'

const router = createBrowserRouter(routes)
const database = new LeaforyDatabase()
const repositories = createLocalRepositories(database)
if (import.meta.hot) import.meta.hot.dispose(() => database.close())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RepositoryProvider repositories={repositories}>
      <App router={router} />
    </RepositoryProvider>
  </StrictMode>,
)
