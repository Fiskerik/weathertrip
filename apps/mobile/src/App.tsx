import { Component, type ErrorInfo, type ReactNode } from "react";
import { StatusBar, StyleSheet, Text, View } from "react-native";

import HomeScreen from "../app";
import { colors } from "./theme";

type State = {
  error: Error | null;
};

class AppErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Weathertrip render error", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <View style={styles.errorScreen}>
          <Text style={styles.errorTitle}>Weathertrip hit a startup error</Text>
          <Text style={styles.errorMessage}>{this.state.error.message}</Text>
        </View>
      );
    }

    return this.props.children;
  }
}

export default function App() {
  return (
    <AppErrorBoundary>
      <StatusBar barStyle="dark-content" />
      <HomeScreen />
    </AppErrorBoundary>
  );
}

const styles = StyleSheet.create({
  errorScreen: {
    alignItems: "center",
    backgroundColor: colors.paper,
    flex: 1,
    justifyContent: "center",
    padding: 24
  },
  errorTitle: {
    color: colors.ink,
    fontSize: 22,
    fontWeight: "900",
    marginBottom: 10,
    textAlign: "center"
  },
  errorMessage: {
    color: colors.coral,
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 21,
    textAlign: "center"
  }
});
