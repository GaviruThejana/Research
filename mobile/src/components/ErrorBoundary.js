import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Button, colors } from "./ui";

/**
 * Last line of defence: if any screen throws while rendering, show a
 * recovery screen instead of a blank/frozen app. (API errors don't reach
 * here; screens catch those and show alerts.)
 */
export default class ErrorBoundary extends React.Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("[ErrorBoundary]", error, info?.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <View style={styles.container} accessibilityRole="alert">
        <Text style={styles.title}>Something went wrong</Text>
        <Text style={styles.body}>The app hit an unexpected problem. Your data is safe on the server.</Text>
        {__DEV__ && <Text style={styles.detail}>{String(this.state.error?.message || this.state.error)}</Text>}
        <Button title="Try again" onPress={() => this.setState({ error: null })} />
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 24, gap: 16, backgroundColor: colors.background },
  title: { fontSize: 22, fontWeight: "700", color: colors.ink },
  body: { fontSize: 15, color: colors.muted },
  detail: { fontSize: 12, color: colors.rose, fontFamily: "monospace" },
});
