import type { CapacitorConfig } from "@capacitor/cli";

/**
 * The App Store app. `appId` must match the Bundle ID registered in your Apple
 * Developer account; change it there and here together if you pick another.
 */
const config: CapacitorConfig = {
  appId: "com.sulimanobead.almohafez",
  appName: "المحافظ",
  webDir: "dist-app",
  backgroundColor: "#0e6e78",
  ios: {
    contentInset: "never",
    backgroundColor: "#0e6e78",
    scrollEnabled: false,
    limitsNavigationsToAppBoundDomains: true,
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: false,
      launchShowDuration: 3000,
      backgroundColor: "#0e6e78",
      showSpinner: false,
    },
    StatusBar: {
      style: "DARK",
      overlaysWebView: true,
    },
    // Live updates (Capgo): off until you create an account and set it up — see
    // APP_STORE.md. With it on, web changes reach players without App Store review.
    CapacitorUpdater: {
      autoUpdate: false,
    },
  },
};

export default config;
