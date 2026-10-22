import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.bulkrenamer.app',
  appName: 'Bulk Rename',
  webDir: 'dist',
  backgroundColor: '#07110d',
  android: {
    backgroundColor: '#07110d',
    allowMixedContent: false,
  },
};

export default config;
