import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Picker } from "@react-native-picker/picker";
import { COUNTRIES } from "../constants/countries";
import { colors } from "./ui";

/** Labelled dropdown of supported countries. */
export default function CountryPicker({ label = "Country", value, onChange, error, enabled = true }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.pickerWrapper, error && styles.pickerError]}>
        <Picker selectedValue={value} onValueChange={onChange} enabled={enabled} accessibilityLabel={label}>
          {COUNTRIES.map((country) => (
            <Picker.Item key={country} label={country} value={country} />
          ))}
        </Picker>
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: 6 },
  label: { fontSize: 14, fontWeight: "600", color: colors.ink },
  pickerWrapper: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, backgroundColor: colors.surface },
  pickerError: { borderColor: colors.rose },
  errorText: { color: colors.rose, fontSize: 13 },
});
