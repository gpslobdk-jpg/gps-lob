import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'dk.gpslob.app',
  appName: 'GPS Løb',
  webDir: 'public',
  server: {
    url: 'https://gpslob.dk',
    allowNavigation: [
      'gpslob.dk',
      'www.gpslob.dk',
      '*.gpslob.dk'
    ]
  }
};

export default config;
