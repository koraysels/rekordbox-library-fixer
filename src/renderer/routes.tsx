import { createRootRoute, createRoute, createRouter } from '@tanstack/react-router';
import AppWithRouter from './AppWithRouter';

// Root route - wraps entire app
export const rootRoute = createRootRoute({
  component: AppWithRouter,
});

// Individual routes for each tab
export const duplicatesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
});

export const relocateRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/relocate',
});

export const importRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/import',
});

export const maintenanceRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/maintenance',
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