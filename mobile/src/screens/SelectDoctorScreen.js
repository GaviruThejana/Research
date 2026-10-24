import React from "react";
import { StyleSheet, Text, View } from "react-native";
import CountryDoctorList from "../components/CountryDoctorList";
import { colors } from "../components/ui";

/**
 * "Get Doctor's Opinion", step 1: pick a doctor from the patient's country.
 * route.params: { image, prediction } from the result screen, passed on.
 */
export default function SelectDoctorScreen({ navigation, route }) {
  const { image, prediction } = route.params;

  return (
    <View style={styles.screen}>
      <CountryDoctorList
        ListHeaderComponent={<Text style={styles.hint}>Choose a dermatologist to review your result.</Text>}
        onSelectDoctor={(doctor) => navigation.navigate("ConsultDoctor", { doctor, image, prediction })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  hint: { fontSize: 15, color: colors.ink },
});
