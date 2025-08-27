import { createRouter, createRoute, createRootRoute } from '@tanstack/react-router';
import { Layout } from './components/Layout';
import { DuplicatesPage } from './pages/DuplicatesPage';
import { RelocationPage } from './pages/RelocationPage';
import { AutoImportPage } from './pages/AutoImportPage';
import { MaintenancePage } from './pages/MaintenancePage';

// Create root route with layout
const rootRoute = createRootRoute({
  component: Layout,
});

// Create individual routes
const duplicatesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: DuplicatesPage,
});

const relocationRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/relocate',
  component: RelocationPage,
});

const autoImportRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/auto-import',
  component: AutoImportPage,
});

const maintenanceRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/maintenance',
  component: MaintenancePage,
});

// Create the route tree
const routeTree = rootRoute.addChildren([
  duplicatesRoute,
  relocationRoute,
  autoImportRoute,
  maintenanceRoute,
]);

// Create and export the router instance
export const router = createRouter({
  routeTree,
  defaultPreload: 'intent', // Optimistic loading on hover/focus
});