import { Outlet } from '@tanstack/react-router';
import { motion, AnimatePresence } from 'framer-motion';
import { Sidebar } from './Sidebar';
import { useLocation } from '@tanstack/react-router';

export function Layout() {
  const location = useLocation();
  
  return (
    <div className="flex h-screen bg-gray-900 text-gray-100">
      {/* Sidebar Navigation */}
      <Sidebar />
      
      {/* Main Content Area with Animations */}
      <main className="flex-1 overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="h-full overflow-auto"
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}