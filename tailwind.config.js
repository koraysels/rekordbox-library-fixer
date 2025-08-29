/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Teenage Engineering EP-133 K.O. II inspired colors - Enhanced harmony
        te: {
          orange: '#FF6B35',     // Signature TE orange for accents
          black: '#0A0A0A',      // Deep black for primary UI
          grey: {
            50: '#FAFAFA',       // Lightest background
            100: '#F5F5F5',      // Off-white for backgrounds
            200: '#E8E8E8',      // Light grey for borders
            300: '#D1D1D1',      // Medium light grey
            400: '#A8A8A8',      // Medium grey for secondary text
            500: '#7A7A7A',      // Dark grey for inactive elements
            600: '#4A4A4A',      // Darker grey for components
            700: '#2D2D2D',      // Very dark grey
            800: '#1A1A1A',      // Near black
            900: '#0F0F0F',      // Darkest
          },
          cream: '#FAF6F2',      // Warm off-white like TE devices
          yellow: '#FFD93D',     // Secondary accent (from TE displays)
          
          // Enhanced color harmony using analogous colors around orange
          red: {
            50: '#FFF5F5',       // Very light red background
            100: '#FED7D7',      // Light red for badges
            200: '#FEB2B2',      // Light red borders
            500: '#E53E3E',      // Standard red (less harsh than #FF4757)
            600: '#C53030',      // Darker red for hover states
          },
          green: {
            50: '#F0FFF4',       // Very light green background
            100: '#C6F6D5',      // Light green for badges (easier on eyes)
            200: '#9AE6B4',      // Light green borders
            500: '#38A169',      // Standard green (less harsh than #6BCB77)
            600: '#2F855A',      // Darker green for hover states
          },
          amber: {
            50: '#FFFBEB',       // Very light amber background
            100: '#FEF3C7',      // Light amber for badges
            200: '#FDE68A',      // Light amber borders
            500: '#F59E0B',      // Standard amber (analogous to orange)
            600: '#D97706',      // Darker amber for hover states
          },
        },
        // Keep old colors for backwards compatibility
        rekordbox: {
          purple: '#A855F7',
          dark: '#18181B',
          gray: '#27272A',
          light: '#F4F4F5',
        }
      },
      fontFamily: {
        'te-display': ['Orbitron', 'Space Mono', 'JetBrains Mono', 'SF Mono', 'Monaco', 'Consolas', 'monospace'], // For titles and buttons
        'te-mono': ['Space Mono', 'JetBrains Mono', 'SF Mono', 'Monaco', 'Consolas', 'monospace'], // For regular text
        'te-sans': ['Space Mono', 'Inter', 'system-ui', '-apple-system', 'sans-serif'], // For body text
      },
      letterSpacing: {
        'te-display': '0.1em',        // Extra letter spacing for Orbitron display font
        'te-mono': '0.025em',         // Slight spacing for Space Mono
        'te-wide': '0.15em',          // Even wider spacing for special cases
      },
      borderRadius: {
        'te': '4px',              // Tight radius like TE devices
        'te-lg': '8px',           // Larger radius for cards
      },
      spacing: {
        'te-xs': '2px',
        'te-sm': '4px', 
        'te-md': '8px',
        'te-lg': '16px',
        'te-xl': '24px',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'te-glow': 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        glow: {
          '0%': { boxShadow: '0 0 5px rgba(255, 107, 53, 0.5)' },
          '100%': { boxShadow: '0 0 20px rgba(255, 107, 53, 0.8)' },
        }
      }
    },
  },
  plugins: [],
}
