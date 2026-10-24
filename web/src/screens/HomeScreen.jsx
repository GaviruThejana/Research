import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Camera, ChevronRight, Clock, Focus, History, ImagePlus, Info, LayoutDashboard, RefreshCw, ScanSearch, Stethoscope, Sun, Upload } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { canUseAdminPortal } from "../auth/roles";
import { fetchMyPredictions, predictLesion } from "../api/predictApi";
import { toAppUrl } from "../api/client";
import { Button, Card, ErrorText, Skeleton } from "../components/ui";
import RiskBadge from "../components/RiskBadge";
import { formatModelLabel, getRiskLevel } from "../constants/diseaseLabels";
import { ImageFormatError, prepareImage } from "../utils/image";
import { friendlyMessage, showErrorAlert } from "../utils/errors";
import { greetingName } from "../utils/names";
import { Select } from "../components/CountryPicker";
import { TextField } from "../components/ui";

const PHOTO_TIPS = [
  { icon: Focus, text: "Fill the frame with the lesion, in sharp focus" },
  { icon: Sun, text: "Use bright, even light without flash glare" },
  { icon: Camera, text: "Hold the camera straight above the skin" },
];

/**
 * Pick or take a photo, classify it (Node API -> FastAPI; the JWT is attached
 * by the API client), then open the result. Port of mobile/src/screens/HomeScreen.js.
 *
 * expo-image-picker -> two hidden <input type="file">:
 *  - Camera:  capture="environment" opens the phone's rear camera (desktop
 *             browsers ignore it and show the file chooser).
 *  - Upload:  the photo library / file chooser. Desktop also accepts drag & drop.
 */
export default function HomeScreen() {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const cameraInput = useRef(null);
  const galleryInput = useRef(null);

  const [image, setImage] = useState(null); // prepared JPEG File
  const [previewUrl, setPreviewUrl] = useState(null);
  const [isPreparing, setIsPreparing] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState(null);
  const [patientDetails, setPatientDetails] = useState({ age: "", sex: "", anatomical_site: "" });

  const isPendingDoctor = user?.role === "doctor" && !user?.isApproved;

  // A pending doctor's approval should show up without logging out and in
  // (mobile: useFocusEffect; web: on load and when the tab regains focus).
  useEffect(() => {
    if (!isPendingDoctor) return undefined;
    const refresh = () => refreshUser().catch(() => {});
    refresh();
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, [isPendingDoctor, refreshUser]);

  // Free the preview's object URL when it changes or the screen unmounts.
  useEffect(() => () => previewUrl && URL.revokeObjectURL(previewUrl), [previewUrl]);

  const acceptFile = async (file) => {
    if (!file) return; // cancelled
    setError(null);
    setIsPreparing(true);
    try {
      const prepared = await prepareImage(file);
      setImage(prepared);
      setPreviewUrl(URL.createObjectURL(prepared));
    } catch (err) {
      if (err instanceof ImageFormatError) setError(err.message);
      else showErrorAlert("Couldn't open the photo", err, "Please try a different image.");
    } finally {
      setIsPreparing(false);
    }
  };

  const onFileChosen = (event) => {
    const file = event.target.files?.[0];
    event.target.value = ""; // allow choosing the same file again
    acceptFile(file);
  };

  const onDrop = (event) => {
    event.preventDefault();
    setIsDragging(false);
    if (isAnalyzing || isPreparing) return;
    acceptFile(event.dataTransfer.files?.[0]);
  };

  const analyze = async () => {
    if (patientDetails.age !== "" && (!Number.isInteger(Number(patientDetails.age)) || Number(patientDetails.age) < 0 || Number(patientDetails.age) > 120)) {
      setError("Enter an age between 0 and 120 years, or leave it blank.");
      return;
    }
    setIsAnalyzing(true);
    setError(null);
    try {
      const metadata = {
        ...(patientDetails.age !== "" && { age: Number(patientDetails.age) }),
        ...(patientDetails.sex && { sex: patientDetails.sex }),
        ...(patientDetails.anatomical_site && { anatomical_site: patientDetails.anatomical_site }),
      };
      const prediction = await predictLesion(image, metadata);
      if (prediction.isOod) {
        setError(prediction.oodReason || "This doesn't look like a skin lesion photo. Please try another.");
        return;
      }
      navigate(`/results/${prediction.id}`, { state: { prediction } });
    } catch (err) {
      setError(friendlyMessage(err));
      showErrorAlert("Analysis failed", err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const busy = isPreparing || isAnalyzing;

  return (
    <div className="flex flex-col gap-6">
      <section>
        <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-[28px]">Hello, {greetingName(user?.name)}</h1>
        <p className="mt-1 text-[15px] text-muted">Check a skin lesion in three steps: photo, AI analysis, doctor's opinion.</p>
      </section>

      {isPendingDoctor && (
        <div role="status" className="flex gap-3 rounded-2xl border border-amber/20 bg-amber-soft p-4 text-sm text-amber">
          <Clock size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
          <p>Your doctor registration is awaiting admin approval. You can use the app as a patient until then.</p>
        </div>
      )}

      <Card className="overflow-hidden">
        <div className="flex items-center gap-2 border-b border-line px-5 py-3.5">
          <ScanSearch size={18} className="text-primary" aria-hidden="true" />
          <h2 className="text-base font-semibold text-ink">New skin check</h2>
        </div>

        <div className="flex flex-col gap-4 p-5">
          {/* Dropzone / preview */}
          <div
            role="group"
            aria-label="Lesion photo"
            onDragOver={(e) => {
              e.preventDefault();
              if (!busy) setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={onDrop}
            className={`relative overflow-hidden rounded-2xl border-2 transition-colors ${
              previewUrl ? "border-transparent" : isDragging ? "border-dashed border-primary bg-primary-soft" : "border-dashed border-slate-300 bg-canvas"
            }`}
          >
            {previewUrl ? (
              <div className="relative mx-auto aspect-square w-full max-w-sm">
                <img src={previewUrl} alt="Selected lesion photo, ready to analyse" className="h-full w-full rounded-2xl object-cover" />
                {isAnalyzing && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-2xl bg-primary-deep/60 text-white">
                    <div aria-hidden="true" className="absolute inset-x-6 h-0.5 animate-scan bg-cyan-300 shadow-[0_0_12px_2px] shadow-cyan-300/70" />
                    <RefreshCw size={28} className="animate-spin" aria-hidden="true" />
                    <p className="px-6 text-center text-sm font-semibold">Analysing your photo…</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 px-6 py-10 text-center sm:py-14">
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-soft text-primary">
                  <ImagePlus size={28} aria-hidden="true" />
                </span>
                <div>
                  <p className="text-base font-semibold text-ink">{isPreparing ? "Preparing photo…" : "Add a photo of the skin lesion"}</p>
                  <p className="mt-1 text-sm text-muted">
                    Take a photo or upload one<span className="hidden sm:inline">, or drag and drop it here</span>. JPEG or PNG.
                  </p>
                </div>
              </div>
            )}
          </div>

          <input ref={cameraInput} type="file" accept="image/*" capture="environment" onChange={onFileChosen} className="hidden" tabIndex={-1} aria-hidden="true" />
          <input ref={galleryInput} type="file" accept="image/*" onChange={onFileChosen} className="hidden" tabIndex={-1} aria-hidden="true" />

          <section aria-labelledby="patient-details-heading" className="rounded-2xl border border-line bg-canvas p-4 sm:p-5">
            <div className="mb-4">
              <h3 id="patient-details-heading" className="font-semibold text-ink">Patient details <span className="font-normal text-muted">(optional)</span></h3>
              <p className="mt-1 text-sm text-muted">These details are sent with the image and included in the doctor report. The current classifier bases its prediction on the image.</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <TextField label="Age" type="number" inputMode="numeric" min="0" max="120" step="1" value={patientDetails.age} onChange={(e) => setPatientDetails((prev) => ({ ...prev, age: e.target.value }))} placeholder="Age in years" disabled={busy} />
              <div className="flex flex-col gap-1.5">
                <label htmlFor="patient-sex" className="text-sm font-semibold text-ink">Sex</label>
                <Select id="patient-sex" value={patientDetails.sex} onChange={(e) => setPatientDetails((prev) => ({ ...prev, sex: e.target.value }))} disabled={busy}>
                  <option value="">Select (optional)</option><option value="female">Female</option><option value="male">Male</option><option value="other">Another identity</option><option value="prefer_not_to_say">Prefer not to say</option>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="patient-site" className="text-sm font-semibold text-ink">Body site</label>
                <Select id="patient-site" value={patientDetails.anatomical_site} onChange={(e) => setPatientDetails((prev) => ({ ...prev, anatomical_site: e.target.value }))} disabled={busy}>
                  <option value="">Select (optional)</option><option value="head/neck">Head or neck</option><option value="upper extremity">Arm or hand</option><option value="lower extremity">Leg or foot</option><option value="torso">Torso</option><option value="palms/soles">Palm or sole</option><option value="oral/genital">Oral or genital area</option><option value="unknown">Not sure</option>
                </Select>
              </div>
            </div>
          </section>

          <div className="grid grid-cols-2 gap-3">
            <Button variant="secondary" icon={Camera} onClick={() => cameraInput.current?.click()} disabled={busy} aria-label="Take a photo with the camera">
              {previewUrl ? "Retake" : "Camera"}
            </Button>
            <Button variant="secondary" icon={Upload} onClick={() => galleryInput.current?.click()} disabled={busy} aria-label="Upload a photo from this device">
              {previewUrl ? "Change photo" : "Upload"}
            </Button>
          </div>

          <Button icon={ScanSearch} onClick={analyze} loading={isAnalyzing} loadingText="Analysing…" disabled={!image || isPreparing}>
            Analyse
          </Button>
          <p aria-live="polite" className={isAnalyzing ? "text-center text-sm text-muted" : "sr-only"}>
            {isAnalyzing ? "Analysing your photo. This may take up to two minutes." : ""}
          </p>
          <ErrorText>{error}</ErrorText>

          <ul className="grid gap-2 rounded-xl bg-canvas p-3.5 sm:grid-cols-3" aria-label="Photo tips">
            {PHOTO_TIPS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-start gap-2 text-[13px] text-muted">
                <Icon size={16} className="mt-px shrink-0 text-accent" aria-hidden="true" />
                {text}
              </li>
            ))}
          </ul>
        </div>
      </Card>

      <RecentResults />

      <div className="grid gap-3 sm:grid-cols-2">
        <QuickLink to="/doctors" icon={Stethoscope} tone="bg-accent-soft text-accent" title="Find a dermatologist" text="Browse verified doctors" />
        {canUseAdminPortal(user) && (
          <QuickLink to="/admin" icon={LayoutDashboard} tone="bg-primary-soft text-primary" title="Admin portal" text="Approvals and expert review" />
        )}
      </div>

      <p className="flex items-start gap-2 text-xs text-slate-500">
        <Info size={14} className="mt-px shrink-0" aria-hidden="true" />
        SkinAI is a screening aid for research, not a diagnosis. Always consult a qualified doctor about a skin concern.
      </p>
    </div>
  );
}

function QuickLink({ to, icon: Icon, tone, title, text }) {
  return (
    <Link to={to} className="group flex items-center gap-3 rounded-2xl border border-line bg-surface p-4 shadow-card transition-all hover:border-slate-300 hover:shadow-lift">
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tone}`}>
        <Icon size={20} aria-hidden="true" />
      </span>
      <span className="flex-1">
        <span className="block font-semibold text-ink">{title}</span>
        <span className="block text-sm text-muted">{text}</span>
      </span>
      <ChevronRight size={18} className="text-slate-400 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
    </Link>
  );
}

/** The user's last few predictions (GET /api/predictions), as cards linking to each result. */
function RecentResults() {
  const [items, setItems] = useState(null); // null = loading
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchMyPredictions()
      .then((list) => !cancelled && setItems(list.slice(0, 4)))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, []);

  if (failed || (items && items.length === 0)) return null;

  return (
    <section aria-labelledby="recent-heading" className="flex flex-col gap-3">
      <h2 id="recent-heading" className="flex items-center gap-2 text-base font-semibold text-ink">
        <History size={18} className="text-muted" aria-hidden="true" />
        Recent results
      </h2>
      {items === null ? (
        <div role="status" aria-label="Loading recent results" className="grid gap-3 sm:grid-cols-2">
          <Skeleton className="h-20 rounded-2xl" />
          <Skeleton className="h-20 rounded-2xl" />
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {items.map((p) => (
            <li key={p.id}>
              <Link
                to={`/results/${p.id}`}
                state={{ prediction: p }}
                className="group flex items-center gap-3 rounded-2xl border border-line bg-surface p-3 shadow-card transition-all hover:border-slate-300 hover:shadow-lift"
              >
                <img src={toAppUrl(p.imageUrl)} alt="" className="h-14 w-14 shrink-0 rounded-xl bg-subtle object-cover" />
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="truncate font-semibold text-ink">{formatModelLabel(p.label)}</span>
                  <span className="flex flex-wrap items-center gap-2">
                    <RiskBadge level={getRiskLevel(p.label)} />
                    <span className="text-xs text-slate-500">{new Date(p.createdAt).toLocaleDateString()}</span>
                  </span>
                </span>
                <ChevronRight size={18} className="shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
