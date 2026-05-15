import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.mnemo.mobile",
  appName: "Mnemo",
  webDir: "dist",
  server: {
    androidScheme: "https",
  },
  plugins: {
    StatusBar: {
      overlaysWebView: true,
      backgroundColor: "#00000000",
      style: "LIGHT",
    },
  },
};

export default config;
