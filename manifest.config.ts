import { defineManifest } from '@crxjs/vite-plugin'
import pkg from './package.json'

export default defineManifest({
  manifest_version: 3,
  name: pkg.name,
  description: pkg.description,
  version: pkg.version,
  icons: {
    48: 'public/logo.png',
  },
  action: {
    default_icon: {
      48: 'public/logo.png',
    },
    default_title: 'Petrify',
  },
  permissions: ['downloads', 'storage'],
  options_ui: { page: 'options.html', open_in_tab: true },
  host_permissions: [
    'https://www.instagram.com/*',
    'https://i.instagram.com/*',
  ],
  background: {
    service_worker: 'src/background/main.ts',
    type: 'module',
  },
  content_scripts: [{
    js: ['src/content/main.tsx'],
    matches: ['https://www.instagram.com/*'],
  }],
})
