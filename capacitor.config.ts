import type { CapacitorConfig } from '@capacitor/cli';

const isProd = process.env.NODE_ENV === 'production';

const config: CapacitorConfig = {
  appId: 'com.badbingo.app',
  appName: 'Bad Bingo',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    iosScheme: 'https',
  },
  plugins: {
    Camera: {
      presentationStyle: 'fullscreen',
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    Geolocation: {
      permissionPromptMessage: 'Bad Bingo needs your location to verify proof submissions',
    },
  },
  ios: {
    backgroundColor: '#0a0a0a',
    contentInset: 'automatic',
  },
  android: {
    backgroundColor: '#0a0a0a',
    allowMixedContent: !isProd,
  },
};

export default config;
