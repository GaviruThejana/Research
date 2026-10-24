import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useAuth } from "../auth/AuthContext";
import { fetchDoctorsByCountry } from "../api/doctorsApi";
import { DEFAULT_COUNTRY } from "../constants/countries";
import CountryPicker from "./CountryPicker";
import { Button, ErrorText, colors } from "./ui";
import { friendlyMessage } from "../utils/errors";

/**
 * Lists approved doctors from the logged-in patient's country only
 * (GET /api/doctors/by-country/:country).
 *
 * Accounts created before country was required have none, so the component
 * asks for it once and saves it to the profile.
 *
 * Props:
 *  - onSelectDoctor?: (doctor) => void   makes each row tappable (selection mode)
 *  - ListHeaderComponent?: element rendered above the list
 */
export default function CountryDoctorList({ onSelectDoctor, ListHeaderComponent }) {
  const { user } = useAuth();
  const country = user?.country;

  const [doctors, setDoctors] = useState([]);
  const [isLoading, setIsLoading] = useState(Boolean(country));
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(
    async (refreshing = false) => {
      if (!country) return;
      if (refreshing) setIsRefreshing(true);
      else setIsLoading(true);
      setError(null);
      try {
        setDoctors(await fetchDoctorsByCountry(country));
      } catch (err) {
        setError(friendlyMessage(err));
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [country]
  );

  useEffect(() => {
    load();
  }, [load]);

  if (!country) {
    return <SetCountryPrompt />;
  }

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.teal} />
        <Text style={styles.muted}>Finding doctors in {country}…</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={doctors}
      keyExtractor={(item) => item._id}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => load(true)} />}
      ListHeaderComponent={
        <View style={styles.header}>
          {ListHeaderComponent}
          <Text style={styles.countryLine} accessibilityRole="header">
            Doctors in {country} ({doctors.length})
          </Text>
        </View>
      }
      renderItem={({ item }) => (
        <DoctorRow doctor={item} onPress={onSelectDoctor ? () => onSelectDoctor(item) : undefined} />
      )}
      ListEmptyComponent={
        error ? (
          <View style={styles.empty}>
            <ErrorText>{error}</ErrorText>
            <Button title="Try again" variant="secondary" onPress={() => load()} />
          </View>
        ) : (
          <Text style={styles.emptyText}>
            No approved doctors are registered in {country} yet. Please check back later.
          </Text>
        )
      }
    />
  );
}

/** One doctor: name, email and specialization. */
function DoctorRow({ doctor, onPress }) {
  const content = (
    <>
      <View style={styles.rowBody}>
        <Text style={styles.name}>{doctor.name}</Text>
        <Text style={styles.specialization}>{doctor.specialization}</Text>
        <Text style={styles.email} selectable>
          {doctor.email}
        </Text>
      </View>
      {onPress && <Text style={styles.select}>Select</Text>}
    </>
  );

  return onPress ? (
    <TouchableOpacity
      style={styles.row}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Select ${doctor.name}, ${doctor.specialization}`}
    >
      {content}
    </TouchableOpacity>
  ) : (
    <View style={styles.row}>{content}</View>
  );
}

/** Shown when the account has no country yet. */
function SetCountryPrompt() {
  const { updateProfile } = useAuth();
  const [country, setCountry] = useState(DEFAULT_COUNTRY);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);

  const save = async () => {
    setIsSaving(true);
    setError(null);
    try {
      await updateProfile({ country });
    } catch (err) {
      setError(friendlyMessage(err));
      setIsSaving(false);
    }
  };

  return (
    <View style={styles.prompt}>
      <Text style={styles.promptText}>Tell us where you live so we can show doctors in your country.</Text>
      <CountryPicker value={country} onChange={setCountry} />
      <ErrorText>{error}</ErrorText>
      <Button title="Save country" onPress={save} loading={isSaving} />
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 10, flexGrow: 1 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 16 },
  header: { gap: 12, marginBottom: 4 },
  countryLine: { fontSize: 13, fontWeight: "700", color: colors.muted, textTransform: "uppercase" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowBody: { flex: 1, gap: 2 },
  name: { fontSize: 17, fontWeight: "700", color: colors.ink },
  specialization: { fontSize: 14, color: colors.teal, fontWeight: "600" },
  email: { fontSize: 14, color: colors.muted },
  select: { color: colors.teal, fontWeight: "700", fontSize: 15, paddingLeft: 12 },
  muted: { color: colors.muted },
  empty: { gap: 12, paddingTop: 24 },
  emptyText: { textAlign: "center", color: colors.muted, paddingTop: 24, lineHeight: 20 },
  prompt: { padding: 16, gap: 16 },
  promptText: { fontSize: 15, color: colors.ink },
});
