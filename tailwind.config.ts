import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        hospital: {
          ink: '#182230',
          muted: '#667085',
          line: '#d0d5dd',
          blue: '#175cd3',
          green: '#067647',
          amber: '#b54708',
          red: '#b42318'
        }
      }
    }
  },
  plugins: []
};

export default config;
