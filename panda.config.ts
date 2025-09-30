import { defineConfig } from '@pandacss/dev';
import { createPreset } from '@park-ui/panda-preset';
import blue from '@park-ui/panda-preset/colors/blue';
import neutral from '@park-ui/panda-preset/colors/neutral';
import red from '@park-ui/panda-preset/colors/red';
import green from '@park-ui/panda-preset/colors/green';
import yellow from '@park-ui/panda-preset/colors/yellow';
import orange from '@park-ui/panda-preset/colors/orange';
import purple from '@park-ui/panda-preset/colors/purple';

export default defineConfig({
  preflight: true,
  presets: [
    '@pandacss/preset-base',
    createPreset({
      accentColor: blue,
      grayColor: neutral,
      radius: 'lg'
    })
  ],

  include: ['./src/**/*.{js,jsx,ts,tsx,astro}'],
  exclude: [],

  theme: {
    extend: {
      tokens: {
        colors: {
          work: {
            50: { value: '#eff6ff' },
            100: { value: '#dbeafe' },
            200: { value: '#bfdbfe' },
            300: { value: '#93c5fd' },
            400: { value: '#60a5fa' },
            500: { value: '#3b82f6' },
            600: { value: '#2563eb' },
            700: { value: '#1d4ed8' },
            800: { value: '#1e40af' },
            900: { value: '#1e3a8a' }
          },
          personal: {
            50: { value: '#fdf4ff' },
            100: { value: '#fae8ff' },
            200: { value: '#f5d0fe' },
            300: { value: '#f0abfc' },
            400: { value: '#e879f9' },
            500: { value: '#d946ef' },
            600: { value: '#c026d3' },
            700: { value: '#a21caf' },
            800: { value: '#86198f' },
            900: { value: '#701a75' }
          },
          // Add color palettes
          red: {
            ...red.tokens
          },
          green: {
            ...green.tokens
          },
          yellow: {
            ...yellow.tokens
          },
          orange: {
            ...orange.tokens
          },
          purple: {
            ...purple.tokens
          }
        }
      },
      semanticTokens: {
        colors: {
          'space.work': { value: '{colors.work.500}' },
          'space.personal': { value: '{colors.personal.500}' },
          // Add semantic tokens for colors
          red: {
            ...red.semanticTokens
          },
          green: {
            ...green.semanticTokens
          },
          yellow: {
            ...yellow.semanticTokens
          },
          orange: {
            ...orange.semanticTokens
          },
          purple: {
            ...purple.semanticTokens
          }
        }
      },
      keyframes: {
        spin: {
          from: { transform: 'rotate(0deg)' },
          to: { transform: 'rotate(360deg)' }
        }
      }
    }
  },

  jsxFramework: 'react',

  // The output directory for your css system
  outdir: './styled-system',

  importMap: {
    css: 'styled-system/css',
    recipes: 'styled-system/recipes',
    patterns: 'styled-system/patterns',
    jsx: 'styled-system/jsx'
  },

  conditions: {
    extend: {
      dark: ['&.dark, .dark &'],
      light: ['&.light, .light &']
    }
  },

  lightningcss: true,
  minify: process.env.NODE_ENV === 'production',
  hash:
    process.env.NODE_ENV === 'production'
      ? {
          className: true,
          cssVar: true
        }
      : false,
  hooks: {
    // 'cssgen:done': ({ artifact, content }) => {
    //   if (artifact === 'styles.css') {
    //     return removeUnusedCssVars(removeUnusedKeyframes(content));
    //   }
    // }
  }
});
