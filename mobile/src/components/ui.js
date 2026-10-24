import React from "react";
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

export const colors = {
  ink: "#0E1F2E",
  muted: "#5D7383",
  teal: "#158A82",
  tealDark: "#0E655F",
  rose: "#B4463C",
  amber: "#C9862A",
  border: "#DDE5E9",
  surface: "#FFFFFF",
  background: "#F6F8F9",
  subtle: "#EEF2F4",
};

/** Labelled text input with an optional inline error. */
export function TextField({ label, error, style, ...inputProps }) {
  return (
    <View style={[styles.field, style]}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.muted}
        style={[styles.input, error && styles.inputError, inputProps.multiline && styles.multiline]}
        accessibilityLabel={label}
        {...inputProps}
      />
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

/** Button with primary / secondary / danger variants and a loading state. */
export function Button({ title, onPress, variant = "primary", loading = false, disabled = false, style }) {
  const isDisabled = disabled || loading;
  const variantStyle = styles[variant];
  const textStyle = styles[`${variant}Text`];
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      style={[styles.button, variantStyle, isDisabled && styles.disabled, style]}
    >
      {loading ? (
        <ActivityIndicator color={variant === "primary" ? "#fff" : colors.ink} />
      ) : (
        <Text style={[styles.buttonText, textStyle]}>{title}</Text>
      )}
    </TouchableOpacity>
  );
}

export function ErrorText({ children }) {
  if (!children) return null;
  return (
    <Text style={styles.errorBanner} accessibilityRole="alert">
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  field: { gap: 6 },
  label: { fontSize: 14, fontWeight: "600", color: colors.ink },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    backgroundColor: colors.surface,
    color: colors.ink,
    fontSize: 16,
  },
  multiline: { minHeight: 96, paddingTop: 12, textAlignVertical: "top" },
  inputError: { borderColor: colors.rose },
  errorText: { color: colors.rose, fontSize: 13 },
  errorBanner: { color: colors.rose, fontSize: 14 },
  button: {
    minHeight: 48,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  buttonText: { fontSize: 16, fontWeight: "600" },
  primary: { backgroundColor: colors.teal },
  primaryText: { color: "#fff" },
  secondary: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  secondaryText: { color: colors.ink },
  danger: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.rose },
  dangerText: { color: colors.rose },
  disabled: { opacity: 0.5 },
});
