import { createRootRoute, createRoute, createRouter, createMemoryHistory } from '@tanstack/react-router';
import AppWithRouter from './AppWithRouter';
import { DuplicatesPage } from './components/pages/DuplicatesPage';
import { RelocatePage } from './components/pages/RelocatePage';
import { ImportPage } from './components/pages/ImportPage';
import { MaintenancePage } from './components/pages/MaintenancePage';
import { StatisticsPage } from './components/pages/StatisticsPage';
import { HistoryPage } from './components/pages/HistoryPage';
import { BackupsPage } from './components/pages/BackupsPage';

// Root route - wraps entire app
export const rootRoute = createRootRoute({
  component: AppWithRouter,
});

// Individual routes for each tab
export const duplicatesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: DuplicatesPage,
});

export const relocateRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/relocate',
  component: RelocatePage,
});

export const importRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/import',
  component: ImportPage,
});

export const maintenanceRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/maintenance',
  component: MaintenancePage,
});

export const statisticsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/statistics',
  component: StatisticsPage,
});

export const historyRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/history',
  component: HistoryPage,
});

export const backupsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/backups',
  component: BackupsPage,
});

// Create the route tree
const routeTree = rootRoute.addChildren([
  duplicatesRoute,
  relocateRoute,
  importRoute,
  maintenanceRoute,
  statisticsRoute,
  historyRoute,
  backupsRoute,
]);

// Use memory history so file:// protocol in packaged Electron doesn't break routing
export const router = createRouter({
  routeTree,
  history: createMemoryHistory({ initialEntries: ['/'] }),
  defaultPreload: 'intent',
});

// Type declaration for TypeScript
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
