import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Picker } from "@react-native-picker/picker";
import { useAuth } from "../auth/AuthContext";
import { submitFeedbackReport } from "../api/feedbackApi";
import { friendlyMessage, showErrorAlert } from "../utils/errors";
import { DISEASE_LABELS, formatModelLabel, getRiskLevel } from "../constants/diseaseLabels";

/**
 * Shows the AI prediction and offers two follow-ups:
 *  - "Get Doctor's Opinion": pick a doctor from the patient's country and
 *    email them a PDF report.
 *  - "Report Incorrect Result": flag it for expert review; approved doctors
 *    (user.isDoctor) also pick the correct ground-truth label.
 *
 * route.params:
 *  - image:      local photo { uri, mimeType } (for display only)
 *  - prediction: saved prediction from POST /api/predictions ({ id, label, confidence, ... })
 */
export default function AIResultScreen({ navigation, route }) {
  const { image, prediction } = route.params || {};
  const { user } = useAuth();
  const isDoctor = Boolean(user?.isDoctor);

  const [isReporting, setIsReporting] = useState(false);
  const [doctorLabel, setDoctorLabel] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async () => {
    if (isDoctor && !doctorLabel) {
      setError("Please select the correct diagnosis.");
      return;
    }
    if (isDoctor && doctorLabel.toLowerCase() === formatModelLabel(prediction.label).toLowerCase()) {
      setError("The selected label matches the AI prediction.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // The server looks up the stored image and AI label by id.
      await submitFeedbackReport({
        predictionId: prediction.id,
        // Non-doctors report without a label; the server enforces this too.
        ...(isDoctor && { doctorLabel }),
      });
      setIsSubmitted(true);
      setIsReporting(false);
      Alert.alert("Thank you", "Your report has been sent for expert review.");
    } catch (err) {
      setError(friendlyMessage(err));
      showErrorAlert("Couldn't send your report", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Doctors pick a label first; other users just confirm and submit.
  const handleReportPress = () => {
    if (isDoctor) {
      setIsReporting(true);
      return;
    }
    Alert.alert("Report incorrect result?", "This result will be sent to a doctor for review.", [
      { text: "Cancel", style: "cancel" },
      { text: "Report", style: "destructive", onPress: handleSubmit },
    ]);
  };

  if (!prediction) {
    return (
      <View style={styles.centered}>
        <Text style={styles.muted}>No result available.</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {image?.uri ? <Image source={{ uri: image.uri }} style={styles.image} /> : null}

      <View style={styles.card}>
        <Text style={styles.caption}>AI Prediction</Text>
        <Text style={styles.prediction}>{formatModelLabel(prediction.label)}</Text>
        {getRiskLevel(prediction.label) && (
          <Text style={[styles.risk, styles[`risk${getRiskLevel(prediction.label)}`]]}>
            {getRiskLevel(prediction.label)} Risk
          </Text>
        )}
        {typeof prediction.confidence === "number" && (
          <Text style={styles.muted}>
            Confidence: {(prediction.confidence * 100).toFixed(1)}%
          </Text>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Unsure about this result?</Text>
        <Text style={styles.muted}>
          Send the photo, AI result and your medical history to a verified dermatologist in your country.
        </Text>
        <TouchableOpacity
          style={[styles.button, styles.primaryButton]}
          onPress={() => navigation.navigate("SelectDoctor", { image, prediction })}
          accessibilityRole="button"
        >
          <Text style={styles.primaryButtonText}>Get Doctor's Opinion</Text>
        </TouchableOpacity>
      </View>

      {isSubmitted ? (
        <Text style={styles.success}>Report submitted. Thank you for your feedback.</Text>
      ) : (
        <>
          {!isReporting && (
            <TouchableOpacity
              style={[styles.button, styles.reportButton]}
              onPress={handleReportPress}
              disabled={isSubmitting}
              accessibilityRole="button"
            >
              {isSubmitting ? (
                <ActivityIndicator color="#B4463C" />
              ) : (
                <Text style={styles.reportButtonText}>Report Incorrect Result</Text>
              )}
            </TouchableOpacity>
          )}

          {isDoctor && isReporting && (
            <View style={styles.card}>
              <Text style={styles.caption}>Ground Truth Label</Text>
              <View style={styles.pickerWrapper}>
                <Picker
                  selectedValue={doctorLabel}
                  onValueChange={(value) => {
                    setDoctorLabel(value);
                    setError(null);
                  }}
                  enabled={!isSubmitting}
                >
                  <Picker.Item label="Select the correct diagnosis…" value="" />
                  {DISEASE_LABELS.map((item) => (
                    <Picker.Item key={item.value} label={item.label} value={item.value} />
                  ))}
                </Picker>
              </View>

              <View style={styles.row}>
                <TouchableOpacity
                  style={[styles.button, styles.secondaryButton, styles.flex]}
                  onPress={() => {
                    setIsReporting(false);
                    setError(null);
                  }}
                  disabled={isSubmitting}
                >
                  <Text style={styles.secondaryButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.button, styles.primaryButton, styles.flex]}
                  onPress={handleSubmit}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.primaryButtonText}>Submit</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}

          {error && <Text style={styles.error}>{error}</Text>}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 16 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  image: { width: "100%", aspectRatio: 1, borderRadius: 12, backgroundColor: "#EEF2F4" },
  card: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#DDE5E9",
    gap: 8,
  },
  cardTitle: { fontSize: 17, fontWeight: "700", color: "#0E1F2E" },
  risk: { alignSelf: "flex-start", fontSize: 13, fontWeight: "700", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, overflow: "hidden" },
  riskHigh: { color: "#B4463C", backgroundColor: "#F8E6E4" },
  riskModerate: { color: "#C9862A", backgroundColor: "#FBF3E6" },
  riskLow: { color: "#366E36", backgroundColor: "#E8F0E8" },
  caption: { fontSize: 12, fontWeight: "600", color: "#5D7383", textTransform: "uppercase" },
  prediction: { fontSize: 24, fontWeight: "700", color: "#0E1F2E" },
  muted: { fontSize: 14, color: "#5D7383" },
  pickerWrapper: { borderWidth: 1, borderColor: "#DDE5E9", borderRadius: 8 },
  row: { flexDirection: "row", gap: 12 },
  flex: { flex: 1 },
  button: {
    minHeight: 48,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  reportButton: { borderWidth: 1, borderColor: "#B4463C", backgroundColor: "#fff" },
  reportButtonText: { color: "#B4463C", fontWeight: "600", fontSize: 16 },
  primaryButton: { backgroundColor: "#158A82" },
  primaryButtonText: { color: "#fff", fontWeight: "600", fontSize: 16 },
  secondaryButton: { borderWidth: 1, borderColor: "#DDE5E9", backgroundColor: "#fff" },
  secondaryButtonText: { color: "#0E1F2E", fontWeight: "600", fontSize: 16 },
  error: { color: "#B4463C", fontSize: 14 },
  success: { color: "#0E655F", fontSize: 15, fontWeight: "600" },
});
