import { NavigationContainer, type NavigatorScreenParams } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { StatusBar } from "expo-status-bar";
import { Home, Map, UserRound } from "lucide-react-native";
import { Component, type ErrorInfo, type ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ProfileScreen, PlanScreen, SavedTripScreen, TripsScreen } from "./screens";
import { colors } from "./theme";

export type RootStackParamList = {
  Tabs: NavigatorScreenParams<TabParamList> | undefined;
  SavedTrip: { tripId: string };
};

export type TabParamList = {
  Plan: undefined;
  Trips: undefined;
  Profile: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tabs = createBottomTabNavigator<TabParamList>();

function TabNavigator() {
  return (
    <Tabs.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.green,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: styles.tabLabel,
        tabBarStyle: styles.tabBar
      }}
    >
      <Tabs.Screen name="Plan" component={PlanScreen} options={{ tabBarIcon: ({ color }) => <Home size={21} color={color} /> }} />
      <Tabs.Screen name="Trips" component={TripsScreen} options={{ tabBarIcon: ({ color }) => <Map size={21} color={color} /> }} />
      <Tabs.Screen name="Profile" component={ProfileScreen} options={{ tabBarIcon: ({ color }) => <UserRound size={21} color={color} /> }} />
    </Tabs.Navigator>
  );
}

class AppErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Weathertrip render error", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <View style={styles.errorScreen}>
          <Text style={styles.errorTitle}>Weathertrip could not open</Text>
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
      <SafeAreaProvider>
        <NavigationContainer>
          <StatusBar style="dark" />
          <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.paper } }}>
            <Stack.Screen name="Tabs" component={TabNavigator} />
            <Stack.Screen name="SavedTrip" component={SavedTripScreen} />
          </Stack.Navigator>
        </NavigationContainer>
      </SafeAreaProvider>
    </AppErrorBoundary>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: colors.surface,
    borderTopColor: colors.line,
    height: 68,
    paddingBottom: 8,
    paddingTop: 7
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: "700"
  },
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
