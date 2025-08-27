import { Link } from '@tanstack/react-router';
import { 
  Music, 
  MapPin, 
  Download, 
  Wrench,
  Copy
} from 'lucide-react';
import { motion } from 'framer-motion';

const navItems = [
  {
    path: '/',
    label: 'Duplicate Detection',
    icon: Copy,
    description: 'Find and resolve duplicate tracks'
  },
  {
    path: '/relocate',
    label: 'Track Relocation',
    icon: MapPin,
    description: 'Fix missing and moved tracks'
  },
  {
    path: '/auto-import',
    label: 'Auto Import',
    icon: Download,
    description: 'Automatic track importing'
  },
  {
    path: '/maintenance',
    label: 'Maintenance',
    icon: Wrench,
    description: 'Library maintenance tools'
  }
];

export function Sidebar() {
  return (
    <nav className="w-64 bg-gray-800 border-r border-gray-700 flex flex-col">
      {/* App Header */}
      <div className="p-4 border-b border-gray-700">
        <div className="flex items-center gap-3">
          <Music className="w-8 h-8 text-rekordbox-purple" />
          <div>
            <h1 className="font-bold text-lg">Rekordbox</h1>
            <p className="text-xs text-gray-400">Library Manager</p>
          </div>
        </div>
      </div>
      
      {/* Navigation Links */}
      <div className="flex-1 p-4">
        <ul className="space-y-2">
          {navItems.map((item) => (
            <li key={item.path}>
              <Link
                to={item.path}
                className="group"
                activeProps={{
                  className: 'bg-rekordbox-purple/20'
                }}
              >
                {({ isActive }) => (
                  <motion.div
                    whileHover={{ x: 4 }}
                    whileTap={{ scale: 0.98 }}
                    className={`
                      flex items-center gap-3 p-3 rounded-lg
                      transition-colors duration-200
                      ${isActive 
                        ? 'bg-rekordbox-purple/20 text-rekordbox-purple' 
                        : 'hover:bg-gray-700 text-gray-300 hover:text-white'
                      }
                    `}
                  >
                    <item.icon className="w-5 h-5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">
                        {item.label}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        {item.description}
                      </p>
                    </div>
                    {isActive && (
                      <motion.div
                        layoutId="activeIndicator"
                        className="w-1 h-8 bg-rekordbox-purple rounded-full"
                        initial={false}
                        transition={{
                          type: 'spring',
                          stiffness: 500,
                          damping: 30
                        }}
                      />
                    )}
                  </motion.div>
                )}
              </Link>
            </li>
          ))}
        </ul>
      </div>
      
      {/* Footer */}
      <div className="p-4 border-t border-gray-700">
        <p className="text-xs text-gray-500">
          Version 0.0.2
        </p>
      </div>
    </nav>
  );
}