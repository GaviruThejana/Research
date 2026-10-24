import React from "react";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { AuthProvider, useAuth } from "./src/auth/AuthContext";
import { colors } from "./src/components/ui";
import ErrorBoundary from "./src/components/ErrorBoundary";
import LoginScreen from "./src/screens/auth/LoginScreen";
import RegisterScreen from "./src/screens/auth/RegisterScreen";
import DoctorRegisterScreen from "./src/screens/auth/DoctorRegisterScreen";
import HomeScreen from "./src/screens/HomeScreen";
import AIResultScreen from "./src/screens/AIResultScreen";
import DoctorDirectoryScreen from "./src/screens/DoctorDirectoryScreen";
import SelectDoctorScreen from "./src/screens/SelectDoctorScreen";
import ConsultDoctorScreen from "./src/screens/ConsultDoctorScreen";

const Stack = createNativeStackNavigator();

const screenOptions = {
  headerTintColor: colors.ink,
  headerStyle: { backgroundColor: colors.surface },
  contentStyle: { backgroundColor: colors.background },
};

function AuthSplash() {
  return (
    <View style={styles.splash}>
      <ActivityIndicator size="large" color={colors.teal} />
      <Text style={styles.splashText}>Checking session…</Text>
    </View>
  );
}

/**
 * Auth stack (no token) vs main app stack (valid token).
 * Token restore runs in AuthProvider (tokenStorage -> SecureStore); the API
 * client attaches the token to every request and logs out on any 401.
 */
function RootNavigator() {
  const { token, isRestoring, logout } = useAuth();

  if (isRestoring) {
    return <AuthSplash />;
  }

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      {token ? (
        <>
          <Stack.Screen
            name="Home"
            component={HomeScreen}
            options={{
              title: "SkinAI",
              headerRight: () => (
                <TouchableOpacity onPress={logout} accessibilityRole="button">
                  <Text style={styles.logoutText}>Log out</Text>
                </TouchableOpacity>
              ),
            }}
          />
          <Stack.Screen name="Result" component={AIResultScreen} options={{ title: "AI Result" }} />
          <Stack.Screen name="Doctors" component={DoctorDirectoryScreen} options={{ title: "Find a Dermatologist" }} />
          <Stack.Screen name="SelectDoctor" component={SelectDoctorScreen} options={{ title: "Get Doctor's Opinion" }} />
          <Stack.Screen name="ConsultDoctor" component={ConsultDoctorScreen} options={{ title: "Send Report" }} />
        </>
      ) : (
        <>
          <Stack.Screen
            name="Login"
            component={LoginScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="RegisterPatient"
            component={RegisterScreen}
            options={{ title: "Create Patient Account" }}
          />
          <Stack.Screen
            name="RegisterDoctor"
            component={DoctorRegisterScreen}
            options={{ title: "Doctor Registration" }}
          />
        </>
      )}
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      {/* Catches render crashes anywhere below and shows a recovery screen. */}
      <ErrorBoundary>
        <AuthProvider>
          <NavigationContainer>
            <StatusBar style="dark" />
            <RootNavigator />
          </NavigationContainer>
        </AuthProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
    gap: 12,
  },
  splashText: {
    fontSize: 15,
    color: colors.muted,
  },
  logoutText: {
    color: colors.teal,
    fontWeight: "600",
  },
});
