import React, { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { ClipboardList, Home, Lock, Send } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { sendConsultation } from "../api/consultationApi";
import { fetchApprovedDoctors } from "../api/doctorsApi";
import { toAppUrl } from "../api/client";
import { Button, Card, ErrorText, Skeleton, TextField } from "../components/ui";
import { showAlert } from "../components/dialog";
import ConsultSteps from "../components/ConsultSteps";
import DoctorCard from "../components/DoctorCard";
import RiskBadge from "../components/RiskBadge";
import { formatModelLabel, getRiskLevel } from "../constants/diseaseLabels";
import { usePrediction } from "../hooks/usePrediction";
import { friendlyMessage, showErrorAlert } from "../utils/errors";

const FAMILY_HISTORY_OPTIONS = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
  { value: "unknown", label: "Not sure" },
];

/**
 * "Get Doctor's Opinion", step 2 (port of mobile/src/screens/ConsultDoctorScreen.js):
 * review what will be shared, fill in the medical history (pre-filled from the
 * profile), and send. The server builds the PDF report and emails it to the
 * doctor, CCing the patient.
 */
export default function ConsultDoctorScreen() {
  const { doctorId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { prediction, isLoading: isLoadingPrediction, error: predictionError } = usePrediction();
  const { doctor, isLoading: isLoadingDoctor, error: doctorError } = useDoctor(doctorId, location.state?.doctor);
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

  const update = (key) => (value) => setHistory((prev) => ({ ...prev, [key]: value }));
  const onInput = (key) => (event) => update(key)(event.target.value);

  if (isLoadingPrediction || isLoadingDoctor) return <ConsultSkeleton />;
  if (!prediction || !doctor) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <p className="text-sm text-muted">{predictionError || doctorError || "This report can't be prepared."}</p>
        <Link to="/" className="inline-flex min-h-11 items-center gap-2 font-semibold text-primary hover:underline">
          <Home size={18} aria-hidden="true" />
          Back to home
        </Link>
      </div>
    );
  }

  const predictionLabel = formatModelLabel(prediction.label);
  const risk = getRiskLevel(prediction.label);

  const handleSend = async (event) => {
    event.preventDefault();
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
      showAlert("Report sent", message);
      // mobile: navigation.popTo("Result") -> drop the doctor list + this screen.
      if (location.state?.fromResult) navigate(-2);
      else navigate(`/results/${prediction.id}`, { replace: true, state: { prediction } });
    } catch (err) {
      setError(friendlyMessage(err));
      showErrorAlert("Report not sent", err);
      setIsSending(false);
    }
  };

  return (
    <form onSubmit={handleSend} className="flex flex-col gap-5">
      <ConsultSteps current={2} />

      <div className="grid gap-4 md:grid-cols-2">
        <section aria-labelledby="sending-to" className="flex flex-col gap-2">
          <h2 id="sending-to" className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Sending to
          </h2>
          <DoctorCard doctor={doctor} />
        </section>
        <section aria-labelledby="ai-result" className="flex flex-col gap-2">
          <h2 id="ai-result" className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            AI result
          </h2>
          <Card className="flex items-center gap-3.5 p-4">
            <img src={toAppUrl(prediction.imageUrl)} alt="Lesion photo to be shared" className="h-[72px] w-[72px] shrink-0 rounded-xl bg-subtle object-cover" />
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <p className="text-[17px] font-bold leading-tight text-ink">{predictionLabel}</p>
              <RiskBadge level={risk} />
              {typeof prediction.confidence === "number" && (
                <p className="text-sm text-muted">{(prediction.confidence * 100).toFixed(1)}% confidence</p>
              )}
            </div>
          </Card>
        </section>
      </div>

      <Card className="flex flex-col gap-5 p-5 sm:p-6">
        <div className="flex items-center gap-2">
          <ClipboardList size={20} className="text-primary" aria-hidden="true" />
          <h2 className="text-[17px] font-bold text-ink">Medical history</h2>
        </div>
        <p className="-mt-3 text-sm text-muted">Pre-filled from your last report. It helps the doctor assess your result.</p>

        <TextField
          label="Previous skin conditions"
          value={history.previousSkinConditions}
          onChange={onInput("previousSkinConditions")}
          maxLength={500}
          placeholder="e.g. eczema, psoriasis, removed moles"
        />

        <fieldset className="flex flex-col gap-1.5">
          <legend className="mb-1.5 text-sm font-semibold text-ink">Family history of skin cancer?</legend>
          <div className="grid grid-cols-3 gap-1 rounded-xl border border-line bg-canvas p-1">
            {FAMILY_HISTORY_OPTIONS.map((option) => {
              const selected = history.familyHistoryOfSkinCancer === option.value;
              return (
                <label
                  key={option.value}
                  className={`flex min-h-11 cursor-pointer items-center justify-center rounded-lg text-[15px] font-semibold transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary ${
                    selected ? "bg-primary text-white shadow-sm" : "text-muted hover:bg-surface hover:text-ink"
                  }`}
                >
                  <input
                    type="radio"
                    name="familyHistoryOfSkinCancer"
                    value={option.value}
                    checked={selected}
                    onChange={() => update("familyHistoryOfSkinCancer")(option.value)}
                    className="sr-only"
                  />
                  {option.label}
                </label>
              );
            })}
          </div>
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Allergies" value={history.allergies} onChange={onInput("allergies")} maxLength={500} placeholder="e.g. penicillin" />
          <TextField label="Current medications" value={history.currentMedications} onChange={onInput("currentMedications")} maxLength={500} />
        </div>
        <TextField
          label="Other relevant history (optional)"
          value={history.additionalNotes}
          onChange={onInput("additionalNotes")}
          multiline
          maxLength={1000}
          placeholder="e.g. frequent sun exposure, sunburns, previous biopsies"
        />
        <TextField
          label="About this lesion (optional)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          multiline
          maxLength={1000}
          placeholder="e.g. how long you've had it, any changes, itching or bleeding"
        />
      </Card>

      <div className="flex gap-3 rounded-2xl border border-line bg-surface p-4 text-[13px] leading-[19px] text-muted">
        <Lock size={18} className="mt-0.5 shrink-0 text-accent" aria-hidden="true" />
        <p>
          A PDF with your details ({user?.name}, {user?.email}), the photo, the AI result and your medical history will be emailed to{" "}
          <span className="font-semibold text-ink">{doctor.name}</span>. You'll receive a copy, and the doctor can reply to you directly.
        </p>
      </div>

      <ErrorText>{error}</ErrorText>
      <Button type="submit" icon={Send} loading={isSending} loadingText="Sending report…">
        Send report to {doctor.name}
      </Button>
    </form>
  );
}

function ConsultSkeleton() {
  return (
    <div role="status" aria-label="Loading" className="flex flex-col gap-5">
      <Skeleton className="h-7 w-full" />
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-28 rounded-2xl" />
        <Skeleton className="h-28 rounded-2xl" />
      </div>
      <Skeleton className="h-80 rounded-2xl" />
      <span className="sr-only">Loading…</span>
    </div>
  );
}

/**
 * The selected doctor: from router state when navigating in the app,
 * otherwise (refresh / shared link) looked up among approved doctors.
 */
function useDoctor(doctorId, fromState) {
  const initial = fromState?._id === doctorId ? fromState : null;
  const [doctor, setDoctor] = useState(initial);
  const [isLoading, setIsLoading] = useState(!initial);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (initial) return undefined;
    let cancelled = false;
    fetchApprovedDoctors()
      .then((list) => {
        if (cancelled) return;
        const found = list.find((d) => d._id === doctorId);
        if (found) setDoctor(found);
        else setError("This doctor is no longer available.");
      })
      .catch((err) => !cancelled && setError(friendlyMessage(err)))
      .finally(() => !cancelled && setIsLoading(false));
    return () => {
      cancelled = true;
    };
  }, [doctorId, initial]);

  return { doctor: doctor || initial, isLoading, error };
}
