import React from "react";
import { Button } from "./ui";

/**
 * Last line of defence: if any screen throws while rendering, show a
 * recovery screen instead of a blank page. (API errors don't reach here;
 * screens catch those and show alerts.)
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
      <main role="alert" className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 bg-canvas p-6">
        <h1 className="text-2xl font-bold text-ink">Something went wrong</h1>
        <p className="text-[15px] text-muted">The app hit an unexpected problem. Your data is safe on the server.</p>
        {import.meta.env.DEV && (
          <pre className="whitespace-pre-wrap font-mono text-xs text-rose">{String(this.state.error?.message || this.state.error)}</pre>
        )}
        <Button onClick={() => this.setState({ error: null })}>Try again</Button>
      </main>
    );
  }
}
