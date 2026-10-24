import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, RefreshControl, SectionList, StyleSheet, Text, TextInput, View } from "react-native";
import { fetchApprovedDoctors } from "../api/doctorsApi";
import { friendlyMessage } from "../utils/errors";
import { Button, colors } from "../components/ui";

const SECTIONS = [
  { key: "local", title: "Local - Sri Lanka" },
  { key: "international", title: "International Specialists" },
];

/**
 * Clinic finder: all approved doctors grouped into local and international,
 * filterable by name or country. (To send a report, the result screen uses
 * the country-filtered SelectDoctor screen instead.)
 */
export default function DoctorDirectoryScreen() {
  const [doctors, setDoctors] = useState([]);
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(
    async (refreshing = false) => {
      if (refreshing) setIsRefreshing(true);
      setError(null);
      try {
        setDoctors(await fetchApprovedDoctors());
      } catch (err) {
        setError(friendlyMessage(err));
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    []
  );

  useEffect(() => {
    load();
  }, [load]);

  const sections = useMemo(() => {
    const term = query.trim().toLowerCase();
    const matches = term
      ? doctors.filter((d) => d.name.toLowerCase().includes(term) || d.country.toLowerCase().includes(term))
      : doctors;
    return SECTIONS.map((section) => ({
      ...section,
      data: matches.filter((d) => d.locationCategory === section.key),
    })).filter((section) => section.data.length > 0);
  }, [doctors, query]);

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.teal} />
      </View>
    );
  }

  return (
    <SectionList
      style={styles.list}
      contentContainerStyle={styles.content}
      sections={sections}
      keyExtractor={(item) => item._id}
      stickySectionHeadersEnabled={false}
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => load(true)} />}
      ListHeaderComponent={
        <View style={styles.header}>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search by name or country"
            placeholderTextColor={colors.muted}
            style={styles.search}
            autoCorrect={false}
            clearButtonMode="while-editing"
            accessibilityLabel="Search doctors by name or country"
          />
        </View>
      }
      renderSectionHeader={({ section }) => (
        <Text style={styles.sectionTitle} accessibilityRole="header">
          {section.title} ({section.data.length})
        </Text>
      )}
      renderItem={({ item }) => <DoctorCard doctor={item} />}
      ListEmptyComponent={
        error ? (
          <View style={styles.empty}>
            <Text style={styles.error}>{error}</Text>
            <Button title="Try again" variant="secondary" onPress={() => load()} />
          </View>
        ) : (
          <Text style={styles.emptyText}>
            {query ? `No doctors match "${query}".` : "No approved doctors yet."}
          </Text>
        )
      }
    />
  );
}

function DoctorCard({ doctor }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardBody}>
        <Text style={styles.name}>{doctor.name}</Text>
        <Text style={styles.detail}>{doctor.specialization}</Text>
        <Text style={styles.detail} selectable>
          {doctor.email}
        </Text>
        <Text style={styles.location}>{doctor.country}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, gap: 10 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background },
  header: { gap: 12, marginBottom: 4 },
  search: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    backgroundColor: colors.surface,
    color: colors.ink,
    fontSize: 16,
  },
  sectionTitle: { fontSize: 13, fontWeight: "700", color: colors.muted, textTransform: "uppercase", marginTop: 12 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardBody: { flex: 1, gap: 2 },
  name: { fontSize: 17, fontWeight: "700", color: colors.ink },
  detail: { fontSize: 14, color: colors.muted },
  location: { fontSize: 13, fontWeight: "600", color: colors.teal, marginTop: 4 },
  empty: { gap: 12, paddingTop: 24 },
  emptyText: { textAlign: "center", color: colors.muted, paddingTop: 24 },
  error: { color: colors.rose, textAlign: "center" },
});
