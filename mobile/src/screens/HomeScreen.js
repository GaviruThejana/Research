import React, { useCallback, useState } from "react";
import { Image, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";
import { useAuth } from "../auth/AuthContext";
import { predictLesion } from "../api/predictApi";
import { Button, ErrorText, colors } from "../components/ui";
import { friendlyMessage, showErrorAlert } from "../utils/errors";
import { greetingName } from "../utils/names";

/**
 * Pick or take a photo, classify it (Node API -> FastAPI; the JWT is attached
 * by the API client), then open the result.
 */
export default function HomeScreen({ navigation }) {
  const { user, refreshUser } = useAuth();
  const [image, setImage] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState(null);

  const isPendingDoctor = user?.role === "doctor" && !user?.isApproved;

  // A pending doctor's approval should show up without logging out and in.
  useFocusEffect(
    useCallback(() => {
      if (isPendingDoctor) refreshUser().catch(() => {});
    }, [isPendingDoctor, refreshUser])
  );

  const pickImage = async (fromCamera) => {
    setError(null);
    try {
      const permission = fromCamera
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setError("Permission is required to select a photo.");
        return;
      }
      const options = { mediaTypes: ["images"], quality: 0.8, allowsEditing: true, aspect: [1, 1] };
      const result = fromCamera
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);
      if (result.canceled) return;

      const asset = result.assets[0];
      setImage({ uri: asset.uri, mimeType: asset.mimeType });
    } catch (err) {
      showErrorAlert("Couldn't open the camera or gallery", err, "Please check the app's permissions and try again.");
    }
  };

  const analyze = async () => {
    setIsAnalyzing(true);
    setError(null);
    try {
      const prediction = await predictLesion(image);
      if (prediction.isOod) {
        setError(prediction.oodReason || "This doesn't look like a skin lesion photo. Please try another.");
        return;
      }
      navigation.navigate("Result", { image, prediction });
    } catch (err) {
      setError(friendlyMessage(err));
      showErrorAlert("Analysis failed", err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.greeting}>Hello, {greetingName(user?.name)}</Text>

      {isPendingDoctor && (
        <Text style={styles.notice}>
          Your doctor registration is awaiting admin approval. You can use the app as a patient until then.
        </Text>
      )}

      {image ? (
        <Image source={{ uri: image.uri }} style={styles.preview} accessibilityLabel="Selected lesion photo" />
      ) : (
        <View style={[styles.preview, styles.placeholder]}>
          <Text style={styles.muted}>No photo selected</Text>
        </View>
      )}

      <View style={styles.row}>
        <Button title="Camera" variant="secondary" onPress={() => pickImage(true)} style={styles.flex} />
        <Button title="Gallery" variant="secondary" onPress={() => pickImage(false)} style={styles.flex} />
      </View>
      <Button title="Analyse" onPress={analyze} loading={isAnalyzing} disabled={!image} />
      <ErrorText>{error}</ErrorText>

      <Button
        title="Find a dermatologist"
        variant="secondary"
        onPress={() => navigation.navigate("Doctors")}
        style={styles.directoryButton}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 16, backgroundColor: colors.background },
  greeting: { fontSize: 24, fontWeight: "700", color: colors.ink },
  notice: { backgroundColor: "#FBF3E6", color: colors.amber, padding: 12, borderRadius: 10, fontSize: 14 },
  preview: { width: "100%", aspectRatio: 1, borderRadius: 12 },
  placeholder: { backgroundColor: colors.subtle, alignItems: "center", justifyContent: "center" },
  muted: { color: colors.muted },
  row: { flexDirection: "row", gap: 12 },
  flex: { flex: 1 },
  directoryButton: { marginTop: 8 },
});
