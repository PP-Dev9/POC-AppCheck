import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.checkngan.app',
  appName: 'CheckNgan',
  webDir: 'www',
  server: {
    androidScheme: 'https',
    cleartext: true
  }
};

export default config;
