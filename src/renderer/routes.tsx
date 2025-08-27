import { createRootRoute, createRoute, createRouter } from '@tanstack/react-router';
import AppWithRouter from './AppWithRouter';
import DuplicateDetector from './components/DuplicateDetector';
import { TrackRelocator } from './components/TrackRelocator';
import { ImportPage } from './components/pages/ImportPage';
import { MaintenancePage } from './components/pages/MaintenancePage';

// Root route - wraps entire app
export const rootRoute = createRootRoute({
  component: AppWithRouter,
});

// Individual routes for each tab
export const duplicatesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: DuplicateDetector,
});

export const relocateRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/relocate',
  component: TrackRelocator,
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

// Create the route tree
const routeTree = rootRoute.addChildren([
  duplicatesRoute,
  relocateRoute,
  importRoute,
  maintenanceRoute,
]);

// Create and export router
export const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
});

// Type declaration for TypeScript
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}