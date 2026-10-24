import React, { useState } from "react";
import { Alert, Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useAuth } from "../auth/AuthContext";
import { sendConsultation } from "../api/consultationApi";
import { Button, ErrorText, TextField, colors } from "../components/ui";
import { formatModelLabel, getRiskLevel } from "../constants/diseaseLabels";
import { friendlyMessage, showErrorAlert } from "../utils/errors";

const FAMILY_HISTORY_OPTIONS = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
  { value: "unknown", label: "Not sure" },
];

/**
 * "Get Doctor's Opinion", step 2: review what will be shared, fill in the
 * medical history (pre-filled from the profile), and send. The server builds
 * the PDF report and emails it to the doctor, CCing the patient.
 *
 * route.params: { doctor, image, prediction }
 */
export default function ConsultDoctorScreen({ navigation, route }) {
  const { doctor, image, prediction } = route.params;
  const { user, refreshUser } = useAuth();
  const saved = user?.medicalHistory || {};

  const [history, setHistory] = useState({
    previousSkinConditions: saved.previousSkinConditions || "",
    familyHistoryOfSkinCancer: saved.familyHistoryOfSkinCancer || "unknown",
    allergies: saved.allergies || "",
    currentMedications: saved.currentMedications || "",
    additionalNotes: saved.additionalNotes || "",
  });
  const [note, setNote] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState(null);

  const predictionLabel = formatModelLabel(prediction.label);
  const risk = getRiskLevel(prediction.label);
  const update = (key) => (value) => setHistory((prev) => ({ ...prev, [key]: value }));

  const handleSend = async () => {
    setIsSending(true);
    setError(null);
    try {
      // Only the prediction id is sent: the server uses the image + AI result it stored.
      const { message } = await sendConsultation({
        doctorEmail: doctor.email,
        predictionId: prediction.id,
        medicalHistory: Object.fromEntries(Object.entries(history).map(([k, v]) => [k, v.trim()])),
        patientNote: note.trim() || undefined,
      });
      // The server saved the history to the profile; pull it so it's pre-filled next time.
      refreshUser().catch(() => {});
      Alert.alert("Report sent", message);
      navigation.popTo("Result", { image, prediction });
    } catch (err) {
      setError(friendlyMessage(err));
      showErrorAlert("Report not sent", err);
      setIsSending(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.caption}>Sending to</Text>
          <Text style={styles.doctorName}>{doctor.name}</Text>
          <Text style={styles.muted}>{doctor.specialization}</Text>
          <Text style={styles.muted}>{doctor.email}</Text>
        </View>

        <View style={[styles.card, styles.row]}>
          <Image source={{ uri: image.uri }} style={styles.thumb} accessibilityLabel="Lesion photo to be shared" />
          <View style={styles.flex}>
            <Text style={styles.caption}>AI prediction</Text>
            <Text style={styles.prediction}>
              {predictionLabel}
              {risk ? ` - ${risk} Risk` : ""}
            </Text>
            {typeof prediction.confidence === "number" && (
              <Text style={styles.muted}>{(prediction.confidence * 100).toFixed(1)}% confidence</Text>
            )}
          </View>
        </View>

        <Text style={styles.sectionTitle} accessibilityRole="header">
          Medical history
        </Text>
        <TextField
          label="Previous skin conditions"
          value={history.previousSkinConditions}
          onChangeText={update("previousSkinConditions")}
          maxLength={500}
          placeholder="e.g. eczema, psoriasis, removed moles"
        />

        <View style={styles.field}>
          <Text style={styles.label}>Family history of skin cancer?</Text>
          <View style={styles.segment} accessibilityRole="radiogroup">
            {FAMILY_HISTORY_OPTIONS.map((option) => {
              const selected = history.familyHistoryOfSkinCancer === option.value;
              return (
                <TouchableOpacity
                  key={option.value}
                  onPress={() => update("familyHistoryOfSkinCancer")(option.value)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  style={[styles.segmentItem, selected && styles.segmentItemActive]}
                >
                  <Text style={[styles.segmentText, selected && styles.segmentTextActive]}>{option.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <TextField label="Allergies" value={history.allergies} onChangeText={update("allergies")} maxLength={500} />
        <TextField
          label="Current medications"
          value={history.currentMedications}
          onChangeText={update("currentMedications")}
          maxLength={500}
        />
        <TextField
          label="Other relevant history (optional)"
          value={history.additionalNotes}
          onChangeText={update("additionalNotes")}
          multiline
          maxLength={1000}
          placeholder="e.g. frequent sun exposure, sunburns, previous biopsies"
        />
        <TextField
          label="About this lesion (optional)"
          value={note}
          onChangeText={setNote}
          multiline
          maxLength={1000}
          placeholder="e.g. how long you've had it, any changes, itching or bleeding"
        />

        <Text style={styles.consent}>
          A PDF with your details ({user?.name}, {user?.email}), the photo, the AI result and your medical history
          will be emailed to {doctor.name}. You'll receive a copy, and the doctor can reply to you directly.
        </Text>

        <ErrorText>{error}</ErrorText>
        <Button title={`Send report to ${doctor.name}`} onPress={handleSend} loading={isSending} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  container: { padding: 16, gap: 16 },
  card: { padding: 16, borderRadius: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, gap: 4 },
  row: { flexDirection: "row", gap: 14, alignItems: "center" },
  caption: { fontSize: 12, fontWeight: "600", color: colors.muted, textTransform: "uppercase" },
  doctorName: { fontSize: 20, fontWeight: "700", color: colors.ink },
  prediction: { fontSize: 18, fontWeight: "700", color: colors.ink },
  muted: { fontSize: 14, color: colors.muted },
  thumb: { width: 72, height: 72, borderRadius: 8, backgroundColor: colors.subtle },
  sectionTitle: { fontSize: 17, fontWeight: "700", color: colors.ink, marginTop: 4 },
  field: { gap: 6 },
  label: { fontSize: 14, fontWeight: "600", color: colors.ink },
  segment: { flexDirection: "row", borderWidth: 1, borderColor: colors.border, borderRadius: 10, overflow: "hidden" },
  segmentItem: { flex: 1, minHeight: 44, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface },
  segmentItemActive: { backgroundColor: colors.teal },
  segmentText: { fontSize: 15, fontWeight: "600", color: colors.ink },
  segmentTextActive: { color: "#fff" },
  consent: { fontSize: 13, color: colors.muted, lineHeight: 19 },
});
