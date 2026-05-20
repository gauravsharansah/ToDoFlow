/** @type {import('@capacitor/cli').CapacitorConfig} */
const config = {
  appId: 'com.todoflow.app',
  appName: 'TodoFlow',
  webDir: 'src',
  server: {
    androidScheme: 'https',
    hostname: 'localhost',
    allowNavigation: [
      '*.firebaseapp.com',
      '*.googleapis.com',
      '*.firebase.google.com',
      'accounts.google.com'
    ]
  },
  android: {
    backgroundColor: '#1a1a2e',
    allowMixedContent: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      backgroundColor: '#1a1a2e',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#1a1a2e'
    }
  }
};

module.exports = config;