import React, { useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text } from "react-native";
import { useAuth } from "../../auth/AuthContext";
import { Button, ErrorText, TextField, colors } from "../../components/ui";
import { friendlyMessage, showErrorAlert } from "../../utils/errors";
import CountryPicker from "../../components/CountryPicker";
import { DEFAULT_COUNTRY } from "../../constants/countries";
import { validateDoctorForm } from "./validation";

/**
 * Doctor registration (role: 'doctor'). Accounts start with isApproved: false;
 * an admin verifies the license before the doctor is listed in the directory.
 */
export default function DoctorRegisterScreen({ navigation }) {
  const { registerDoctor } = useAuth();
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    specialization: "Dermatology",
    country: DEFAULT_COUNTRY,
    licenseNumber: "",
  });
  const [fieldErrors, setFieldErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const update = (key) => (value) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async () => {
    const payload = { ...form };
    const errors = validateDoctorForm(payload);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setIsSubmitting(true);
    setError(null);
    try {
      const trimmed = Object.fromEntries(
        Object.entries(payload).map(([k, v]) => [k, k === "password" ? v : v.trim()])
      );
      const message = await registerDoctor(trimmed);
      Alert.alert(
        "Registration Successful",
        message || "Registration successful. Please wait for Admin approval before logging in.",
        [{ text: "OK", onPress: () => navigation?.navigate("Login") }]
      );
    } catch (err) {
      setError(friendlyMessage(err));
      // Server unreachable (status 0): an alert is hard to miss.
      if (!err.status) showErrorAlert("Can't connect", err);
      setIsSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.subtitle}>
          After you register, an administrator verifies your license. You'll appear in the doctor
          directory once approved.
        </Text>

        <TextField label="Full name" value={form.name} onChangeText={update("name")} error={fieldErrors.name} autoComplete="name" />
        <TextField
          label="Professional email"
          value={form.email}
          onChangeText={update("email")}
          error={fieldErrors.email}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          textContentType="emailAddress"
        />
        <TextField
          label="Password (8+ characters)"
          value={form.password}
          onChangeText={update("password")}
          error={fieldErrors.password}
          secureTextEntry
          autoComplete="password-new"
          textContentType="newPassword"
        />
        <TextField
          label="Specialization"
          value={form.specialization}
          onChangeText={update("specialization")}
          error={fieldErrors.specialization}
        />

        <CountryPicker
          label="Country you practise in"
          value={form.country}
          onChange={update("country")}
          error={fieldErrors.country}
        />

        <TextField
          label="Medical license number"
          value={form.licenseNumber}
          onChangeText={update("licenseNumber")}
          error={fieldErrors.licenseNumber}
          autoCapitalize="characters"
          placeholder="e.g. SLMC 12345"
        />

        <ErrorText>{error}</ErrorText>
        <Button title="Submit for approval" onPress={handleSubmit} loading={isSubmitting} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  container: { padding: 16, gap: 16 },
  subtitle: { fontSize: 15, color: colors.muted },
});
