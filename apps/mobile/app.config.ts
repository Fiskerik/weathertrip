import type { ExpoConfig } from "expo/config";

const config: ExpoConfig = {
  name: "Weathertrip",
  slug: "weathertrip",
  scheme: "weathertrip",
  version: "0.1.0",
  orientation: "portrait",
  icon: "./assets/icon.png",
  userInterfaceStyle: "light",
  splash: {
    image: "./assets/splash.png",
    resizeMode: "contain",
    backgroundColor: "#f7f4ee"
  },
  ios: {
    supportsTablet: false,
    bundleIdentifier: "com.eaconsulting.weathertrip",
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
      NSLocationWhenInUseUsageDescription:
        "Weathertrip uses your location to suggest weather-friendly trips from where you are."
    }
  },
  android: {
    package: "com.eaconsulting.weathertrip"
  },
  plugins: ["expo-router"],
  extra: {
    apiUrl: process.env.EXPO_PUBLIC_WEATHERTRIP_API_URL ?? "http://localhost:4100"
  }
};

export default config;
