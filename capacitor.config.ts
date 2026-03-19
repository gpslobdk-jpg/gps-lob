import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'dk.gpslob.app',
  appName: 'GPS Løb',
  webDir: 'public',
  server: {
    url: 'https://gpslob.dk',
    cleartext: true
  }
};

export default config;
