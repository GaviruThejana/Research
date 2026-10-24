import React, { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text } from "react-native";
import { useAuth } from "../../auth/AuthContext";
import { Button, ErrorText, TextField, colors } from "../../components/ui";
import { friendlyMessage, showErrorAlert } from "../../utils/errors";
import CountryPicker from "../../components/CountryPicker";
import { DEFAULT_COUNTRY } from "../../constants/countries";
import { validatePatientForm } from "./validation";

/**
 * Patient registration. The email address is used to sign in and is CC'd
 * on any report the patient sends to a dermatologist; the country decides
 * which doctors the patient is matched with.
 */
export default function RegisterScreen() {
  const { registerPatient } = useAuth();
  const [form, setForm] = useState({ name: "", emailAddress: "", password: "", country: DEFAULT_COUNTRY });
  const [fieldErrors, setFieldErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const update = (key) => (value) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async () => {
    const errors = validatePatientForm(form);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setIsSubmitting(true);
    setError(null);
    try {
      await registerPatient({ ...form, name: form.name.trim(), emailAddress: form.emailAddress.trim() });
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
          Your email address is where copies of doctor consultation reports are sent.
        </Text>
        <TextField label="Full name" value={form.name} onChangeText={update("name")} error={fieldErrors.name} autoComplete="name" />
        <TextField
          label="Email address"
          value={form.emailAddress}
          onChangeText={update("emailAddress")}
          error={fieldErrors.emailAddress}
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
        <CountryPicker
          label="Country you live in"
          value={form.country}
          onChange={update("country")}
          error={fieldErrors.country}
        />
        <ErrorText>{error}</ErrorText>
        <Button title="Create account" onPress={handleSubmit} loading={isSubmitting} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  container: { padding: 16, gap: 16 },
  subtitle: { fontSize: 15, color: colors.muted },
});
