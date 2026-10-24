import React, { useEffect, useId, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, Flag, Info, ScanSearch, Stethoscope } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { submitFeedbackReport } from "../api/feedbackApi";
import { fetchPredictionHeatmap } from "../api/predictApi";
import { toAppUrl } from "../api/client";
import { Button, Card, ErrorText, Skeleton } from "../components/ui";
import { Select } from "../components/CountryPicker";
import { showAlert } from "../components/dialog";
import ConfidenceMeter from "../components/ConfidenceMeter";
import RiskBadge, { RISK_STYLES } from "../components/RiskBadge";
import { DISEASE_LABELS, formatModelLabel, getRiskLevel } from "../constants/diseaseLabels";
import { usePrediction } from "../hooks/usePrediction";
import { friendlyMessage, showErrorAlert } from "../utils/errors";

/**
 * Shows the AI prediction and offers two follow-ups (port of
 * mobile/src/screens/AIResultScreen.js):
 *  - "Get Doctor's Opinion": pick a doctor from the patient's country and
 *    email them a PDF report.
 *  - "Report Incorrect Result": flag it for expert review; approved doctors
 *    (user.isDoctor) also pick the correct ground-truth label.
 */
export default function AIResultScreen() {
  const { prediction, isLoading, error: loadError } = usePrediction();
  const { user } = useAuth();
  const isDoctor = Boolean(user?.isDoctor);
  const labelId = useId();

  const [isReporting, setIsReporting] = useState(false);
  const [doctorLabel, setDoctorLabel] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState(null);
  const [heatmap, setHeatmap] = useState(null);
  const [heatmapLoading, setHeatmapLoading] = useState(false);
  const [heatmapUnavailable, setHeatmapUnavailable] = useState(false);
  const [heatmapError, setHeatmapError] = useState("");

  useEffect(() => {
    if (!prediction?.id) return undefined;
    let cancelled = false;
    setHeatmap(null);
    setHeatmapUnavailable(false);
    setHeatmapError("");
    setHeatmapLoading(true);
    fetchPredictionHeatmap(prediction.id)
      .then((data) => { if (!cancelled) setHeatmap(data); })
      .catch((err) => {
        if (!cancelled) {
          const status = err?.status ? `HTTP ${err.status}: ` : "";
          const message = err?.message || "Unknown request error";
          console.error(`[heatmap] Failed to load prediction ${prediction.id}: ${status}${message}`, err);
          setHeatmapError(`${status}${message}`);
          setHeatmapUnavailable(true);
        }
      })
      .finally(() => { if (!cancelled) setHeatmapLoading(false); });
    return () => { cancelled = true; };
  }, [prediction?.id]);

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
      showAlert("Thank you", "Your report has been sent for expert review.");
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
    showAlert("Report incorrect result?", "This result will be sent to a doctor for review.", [
      { text: "Cancel", style: "cancel" },
      { text: "Report", style: "destructive", onPress: handleSubmit },
    ]);
  };

  if (isLoading) return <ResultSkeleton />;
  if (!prediction) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <p className="text-sm text-muted">{loadError || "No result available."}</p>
        <Link to="/" className="inline-flex min-h-11 items-center gap-2 font-semibold text-primary hover:underline">
          <ScanSearch size={18} aria-hidden="true" />
          Analyse a photo
        </Link>
      </div>
    );
  }

  const risk = getRiskLevel(prediction.label);
  const riskStyle = RISK_STYLES[risk];
  const topK = (prediction.topK || []).slice(0, 3);

  return (
    <div className="flex flex-col gap-5">
      <Card className="overflow-hidden">
        <div className="grid md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          {prediction.imageUrl && (
            <img
              src={toAppUrl(prediction.imageUrl)}
              alt={`Analysed lesion: ${formatModelLabel(prediction.label)}`}
              className="aspect-square w-full bg-subtle object-cover md:h-full"
            />
          )}
          <section aria-label="AI prediction" className="flex flex-col gap-4 p-5 sm:p-6">
            <div className="flex flex-col gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">AI prediction</p>
              <h2 className="text-2xl font-bold leading-tight tracking-tight text-ink sm:text-[28px]">{formatModelLabel(prediction.label)}</h2>
              <RiskBadge level={risk} size="lg" />
              {riskStyle && <p className="text-sm text-muted">{riskStyle.advice}</p>}
            </div>

            <ConfidenceMeter value={prediction.confidence} barClassName={riskStyle?.bar || "bg-primary"} />

            {topK.length > 0 && <TopProbabilityChart items={topK} />}
            {prediction.patientDetails && Object.values(prediction.patientDetails).some((value) => value !== undefined && value !== "") && (
              <div className="border-t border-line pt-3 text-xs text-muted">
                <span className="font-semibold text-ink">Details shared: </span>
                {[prediction.patientDetails.age != null && `${prediction.patientDetails.age} years`, prediction.patientDetails.sex?.replaceAll("_", " "), prediction.patientDetails.anatomical_site].filter(Boolean).join(" · ")}
              </div>
            )}
          </section>
        </div>
      </Card>

      <Card as="section" aria-labelledby="heatmap-heading" className="overflow-hidden">
        <div className="border-b border-line px-5 py-4 sm:px-6">
          <h2 id="heatmap-heading" className="font-semibold text-ink">Image explanation</h2>
          <p className="mt-1 text-sm text-muted">Grad-CAM highlights image regions that influenced the model output. It does not indicate a diagnosis.</p>
        </div>
        <div className="grid gap-4 p-5 sm:p-6 md:grid-cols-2">
          <figure className="flex flex-col gap-2">
            <figcaption className="text-sm font-medium text-ink">Uploaded image</figcaption>
            <img src={toAppUrl(prediction.imageUrl)} alt="Original lesion photo" className="aspect-square w-full rounded-xl bg-subtle object-contain" />
          </figure>
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium text-ink">AI attention overlay</p>
            {heatmapLoading ? (
              <div role="status" aria-label="Generating image explanation" className="relative aspect-square overflow-hidden rounded-xl bg-subtle p-4">
                <Skeleton className="h-full w-full rounded-xl" />
                <span className="sr-only">Loading the image explanation…</span>
              </div>
            ) : heatmap ? (
              <img
                src={heatmap}
                alt="Grad-CAM overlay highlighting image regions that influenced the AI prediction"
                className="aspect-square w-full rounded-xl bg-subtle object-contain"
                onError={(event) => {
                  console.error(`[heatmap] Browser could not decode the image for prediction ${prediction.id}; source starts with ${heatmap.slice(0, 40)}`);
                  event.currentTarget.removeAttribute("src");
                  setHeatmap(null);
                  setHeatmapError("The API returned image data that the browser could not decode.");
                  setHeatmapUnavailable(true);
                }}
              />
            ) : (
              <div role="status" className="flex aspect-square items-center justify-center rounded-xl border border-dashed border-line bg-canvas p-6 text-center text-sm text-muted">
                <span>{heatmapUnavailable ? `The image explanation is unavailable. ${heatmapError}` : "No image explanation was returned."}</span>
              </div>
            )}
          </div>
        </div>
      </Card>

      <Card className="flex flex-col gap-3 p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
            <Stethoscope size={20} aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-[17px] font-bold text-ink">Unsure about this result?</h2>
            <p className="text-sm text-muted">Send the photo, AI result and your medical history to a verified dermatologist in your country.</p>
          </div>
        </div>
        <Link
          to={`/results/${prediction.id}/doctors`}
          state={{ prediction }}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-base font-semibold text-white shadow-sm transition-colors hover:bg-primary-dark"
        >
          <Stethoscope size={18} aria-hidden="true" />
          Get Doctor's Opinion
        </Link>
      </Card>

      {isSubmitted ? (
        <p role="status" className="flex items-center gap-2 rounded-2xl border border-sage/20 bg-sage-soft p-4 text-[15px] font-semibold text-sage">
          <CheckCircle2 size={20} aria-hidden="true" />
          Report submitted. Thank you for your feedback.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {!isReporting && (
            <Button variant="danger" icon={Flag} onClick={handleReportPress} loading={isSubmitting}>
              Report Incorrect Result
            </Button>
          )}

          {isDoctor && isReporting && (
            <Card className="flex flex-col gap-3 p-5">
              <label htmlFor={labelId} className="text-sm font-semibold text-ink">
                Ground truth label
              </label>
              <p className="-mt-2 text-[13px] text-muted">Your diagnosis is reviewed by an expert before it's used for model training.</p>
              <Select
                id={labelId}
                value={doctorLabel}
                onChange={(e) => {
                  setDoctorLabel(e.target.value);
                  setError(null);
                }}
                disabled={isSubmitting}
              >
                <option value="">Select the correct diagnosis…</option>
                {DISEASE_LABELS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </Select>
              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setIsReporting(false);
                    setError(null);
                  }}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button onClick={handleSubmit} loading={isSubmitting}>
                  Submit
                </Button>
              </div>
            </Card>
          )}

          <ErrorText>{error}</ErrorText>
        </div>
      )}

      <p className="flex items-start gap-2 text-xs text-slate-500">
        <Info size={14} className="mt-px shrink-0" aria-hidden="true" />
        This AI result is a screening aid, not a diagnosis. Only a qualified doctor can diagnose a skin condition.
      </p>
    </div>
  );
}

function TopProbabilityChart({ items }) {
  return (
    <figure className="flex flex-col gap-3 border-t border-line pt-4" aria-labelledby="top-three-title">
      <figcaption id="top-three-title" className="text-sm font-semibold text-ink">Top three model probabilities</figcaption>
      <ol className="flex flex-col gap-3">
        {items.slice(0, 3).map((item, index) => {
          const value = Math.max(0, Math.min(1, Number(item.probability) || 0));
          const percent = value * 100;
          return (
            <li key={item.label} className="grid grid-cols-[1.5rem_minmax(0,1fr)_3.5rem] items-center gap-2.5">
              <span className="text-xs font-semibold text-muted" aria-hidden="true">{index + 1}</span>
              <div className="min-w-0">
                <p className="truncate text-sm text-ink">{item.displayName || formatModelLabel(item.label)}</p>
                <div role="meter" aria-label={`${item.displayName || formatModelLabel(item.label)} probability`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(percent)} aria-valuetext={`${percent.toFixed(1)} percent`} className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-200">
                  <div className={`h-full rounded-full ${index === 0 ? "bg-primary" : "bg-primary/50"}`} style={{ width: `${percent}%` }} />
                </div>
              </div>
              <span className="text-right text-sm font-semibold tabular-nums text-ink">{percent.toFixed(1)}%</span>
            </li>
          );
        })}
      </ol>
      <p className="text-xs text-muted">Probabilities are model estimates and may not represent clinical certainty.</p>
    </figure>
  );
}

function ResultSkeleton() {
  return (
    <div role="status" aria-label="Loading result" className="flex flex-col gap-5">
      <Card className="grid overflow-hidden md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <Skeleton className="aspect-square w-full rounded-none" />
        <div className="flex flex-col gap-3 p-6">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-6 w-28 rounded-full" />
          <Skeleton className="mt-2 h-2.5 w-full rounded-full" />
        </div>
      </Card>
      <Skeleton className="h-36 w-full rounded-2xl" />
      <span className="sr-only">Loading result…</span>
    </div>
  );
}
