import { useEffect, useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import { fetchMyPredictions } from "../api/predictApi";
import { friendlyMessage } from "../utils/errors";

/**
 * The prediction for the `:predictionId` in the URL.
 *
 * Mobile passed the prediction as navigation params (memory only). On the web
 * it arrives in router state when navigating inside the app, and is refetched
 * from GET /api/predictions after a page refresh or when opening a link.
 *
 * @returns {{ prediction: object|null, isLoading: boolean, error: string|null }}
 */
export function usePrediction() {
  const { predictionId } = useParams();
  const location = useLocation();
  const fromState = location.state?.prediction?.id === predictionId ? location.state.prediction : null;

  const [prediction, setPrediction] = useState(fromState);
  const [isLoading, setIsLoading] = useState(!fromState);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (fromState) {
      setPrediction(fromState);
      setError(null);
      setIsLoading(false);
      return undefined;
    }
    let cancelled = false;
    setPrediction(null);
    setIsLoading(true);
    fetchMyPredictions()
      .then((list) => {
        if (cancelled) return;
        const found = list.find((p) => p.id === predictionId);
        if (found) setPrediction(found);
        else setError("This result couldn't be found. It may belong to another account.");
      })
      .catch((err) => !cancelled && setError(friendlyMessage(err)))
      .finally(() => !cancelled && setIsLoading(false));
    return () => {
      cancelled = true;
    };
  }, [predictionId, fromState]);

  return { prediction: prediction || fromState, isLoading, error };
}
