import React, { useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TouchableOpacity } from "react-native";
import { useAuth } from "../../auth/AuthContext";
import { Button, ErrorText, TextField, colors } from "../../components/ui";
import { friendlyMessage, showErrorAlert } from "../../utils/errors";

export default function LoginScreen({ navigation }) {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      await login(email.trim(), password);
      // AuthProvider automatically transitions to Main App upon token storage
    } catch (err) {
      const msg = friendlyMessage(err, "Login failed. Please try again.");
      setError(msg);
      // Server unreachable (status 0): an alert is hard to miss.
      if (!err.status) showErrorAlert("Can't connect", err);
      // Gracefully handle doctor pending admin approval
      if (msg.toLowerCase().includes("pending admin approval") || msg.toLowerCase().includes("approval")) {
        Alert.alert(
          "Pending Admin Approval",
          "Your doctor account is awaiting administrative verification. You will be able to log in once your medical license is approved.",
          [{ text: "OK" }]
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>SkinAI</Text>
        <Text style={styles.subtitle}>Sign in to analyse lesions and consult dermatologists.</Text>

        <TextField
          label="Email address"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          textContentType="emailAddress"
        />
        <TextField
          label="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="password"
          textContentType="password"
          onSubmitEditing={handleLogin}
        />
        <ErrorText>{error}</ErrorText>
        <Button title="Login" onPress={handleLogin} loading={isSubmitting} />

        <TouchableOpacity onPress={() => navigation.navigate("RegisterPatient")} style={styles.link}>
          <Text style={styles.linkText}>Register as Patient</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.navigate("RegisterDoctor")} style={styles.link}>
          <Text style={styles.linkText}>Register as Doctor</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  container: { padding: 16, paddingTop: 64, gap: 16 },
  title: { fontSize: 32, fontWeight: "700", color: colors.ink },
  subtitle: { fontSize: 15, color: colors.muted, marginBottom: 8 },
  link: { paddingVertical: 8, alignItems: "center" },
  linkText: { color: colors.teal, fontWeight: "600", fontSize: 15 },
});
