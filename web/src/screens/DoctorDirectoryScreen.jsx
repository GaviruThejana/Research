import React, { useCallback, useEffect, useId, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight, Globe, MapPin, RefreshCw, ScanSearch, Search, Send, UserX, X } from "lucide-react";
import { fetchApprovedDoctors } from "../api/doctorsApi";
import { fetchMyPredictions } from "../api/predictApi";
import { toAppUrl } from "../api/client";
import DoctorCard from "../components/DoctorCard";
import Modal from "../components/Modal";
import RiskBadge from "../components/RiskBadge";
import { Button, EmptyState, ErrorText, Skeleton, SkeletonList } from "../components/ui";
import { formatModelLabel, getRiskLevel } from "../constants/diseaseLabels";
import { friendlyMessage } from "../utils/errors";

const SECTIONS = [
  { key: "local", title: "Local - Sri Lanka", icon: MapPin },
  { key: "international", title: "International Specialists", icon: Globe },
];

/**
 * Clinic finder: all approved doctors grouped into local and international,
 * filterable by name or country. Port of mobile/src/screens/DoctorDirectoryScreen.js
 * (SectionList -> sections of cards, pull-to-refresh -> Refresh button).
 *
 * Web addition: "Request consultation" on each doctor. A consultation always
 * sends an AI result, so it asks which recent result to send (or to analyse
 * a new photo first), then opens the usual Send Report screen.
 */
export default function DoctorDirectoryScreen() {
  const searchId = useId();
  const [doctors, setDoctors] = useState([]);
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [consultDoctor, setConsultDoctor] = useState(null);

  const load = useCallback(async (refreshing = false) => {
    if (refreshing) setIsRefreshing(true);
    setError(null);
    try {
      setDoctors(await fetchApprovedDoctors());
    } catch (err) {
      setError(friendlyMessage(err));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const sections = useMemo(() => {
    const term = query.trim().toLowerCase();
    const matches = term
      ? doctors.filter((d) => d.name.toLowerCase().includes(term) || d.country.toLowerCase().includes(term))
      : doctors;
    return SECTIONS.map((section) => ({
      ...section,
      data: matches.filter((d) => d.locationCategory === section.key),
    })).filter((section) => section.data.length > 0);
  }, [doctors, query]);

  const resultCount = sections.reduce((n, s) => n + s.data.length, 0);

  return (
    <div className="flex flex-col gap-5">
      <section>
        <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-[28px]">Find a dermatologist</h1>
        <p className="mt-1 text-[15px] text-muted">Every doctor listed has a license verified by our administrators.</p>
      </section>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <label htmlFor={searchId} className="sr-only">
            Search doctors by name or country
          </label>
          <Search size={18} aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            id={searchId}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or country"
            autoCorrect="off"
            aria-describedby={`${searchId}-status`}
            className="min-h-12 w-full rounded-xl border border-line bg-surface pl-11 pr-11 text-base text-ink shadow-card placeholder:text-slate-400 hover:border-slate-300 focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/15 [&::-webkit-search-cancel-button]:hidden"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear search"
              className="absolute right-1 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-lg text-muted hover:bg-subtle"
            >
              <X size={18} aria-hidden="true" />
            </button>
          )}
        </div>
        <Button variant="secondary" icon={RefreshCw} onClick={() => load(true)} loading={isRefreshing} disabled={isLoading} aria-label="Refresh doctors">
          <span className="hidden sm:inline">Refresh</span>
        </Button>
      </div>
      <p id={`${searchId}-status`} aria-live="polite" className="sr-only">
        {!isLoading && (query ? `${resultCount} doctors match "${query}"` : `${resultCount} doctors`)}
      </p>

      {isLoading ? (
        <SkeletonList count={4} label="Loading doctors" itemClassName="h-[104px]" />
      ) : sections.length > 0 ? (
        sections.map((section) => (
          <section key={section.key} aria-labelledby={`section-${section.key}`} className="flex flex-col gap-3">
            <h2 id={`section-${section.key}`} className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
              <section.icon size={16} aria-hidden="true" />
              {section.title} ({section.data.length})
            </h2>
            <ul className="flex flex-col gap-3">
              {section.data.map((doctor) => (
                <li key={doctor._id}>
                  <DoctorCard
                    doctor={doctor}
                    action={
                      <Button size="sm" icon={Send} onClick={() => setConsultDoctor(doctor)} className="w-full sm:w-auto">
                        Request consultation
                      </Button>
                    }
                  />
                </li>
              ))}
            </ul>
          </section>
        ))
      ) : error ? (
        <div className="flex flex-col gap-3">
          <ErrorText>{error}</ErrorText>
          <Button variant="secondary" icon={RefreshCw} onClick={() => load()}>
            Try again
          </Button>
        </div>
      ) : (
        <EmptyState icon={UserX} title={query ? `No doctors match "${query}"` : "No approved doctors yet"}>
          {query ? "Check the spelling, or search by country instead (e.g. Sri Lanka, USA)." : "Doctors appear here once an administrator verifies their license."}
        </EmptyState>
      )}

      <ChooseResultModal doctor={consultDoctor} onClose={() => setConsultDoctor(null)} />
    </div>
  );
}

/** Asks which recent result to send to the chosen doctor. */
function ChooseResultModal({ doctor, onClose }) {
  const navigate = useNavigate();
  const [items, setItems] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!doctor) return undefined;
    let cancelled = false;
    setItems(null);
    setError(null);
    fetchMyPredictions()
      .then((list) => !cancelled && setItems(list.slice(0, 5)))
      .catch((err) => !cancelled && setError(friendlyMessage(err)));
    return () => {
      cancelled = true;
    };
  }, [doctor]);

  const choose = (prediction) => {
    onClose();
    navigate(`/results/${prediction.id}/consult/${doctor._id}`, { state: { doctor, prediction, fromResult: false } });
  };

  return (
    <Modal open={Boolean(doctor)} onClose={onClose} title="Request consultation" description={doctor ? `Choose the result to send to ${doctor.name}.` : undefined}>
      {error ? (
        <ErrorText>{error}</ErrorText>
      ) : items === null ? (
        <div role="status" aria-label="Loading your results" className="flex flex-col gap-2">
          <Skeleton className="h-16 rounded-xl" />
          <Skeleton className="h-16 rounded-xl" />
        </div>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted">You don't have any results yet. Analyse a photo first, then send it to the doctor.</p>
      ) : (
        <ul className="flex max-h-80 flex-col gap-2 overflow-y-auto">
          {items.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => choose(p)}
                className="group flex w-full items-center gap-3 rounded-xl border border-line p-2.5 text-left transition-colors hover:border-primary/40 hover:bg-primary-soft"
              >
                <img src={toAppUrl(p.imageUrl)} alt="" className="h-12 w-12 shrink-0 rounded-lg bg-subtle object-cover" />
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="truncate text-sm font-semibold text-ink">{formatModelLabel(p.label)}</span>
                  <span className="flex flex-wrap items-center gap-2">
                    <RiskBadge level={getRiskLevel(p.label)} />
                    <span className="text-xs text-slate-500">{new Date(p.createdAt).toLocaleString()}</span>
                  </span>
                </span>
                <ChevronRight size={18} className="shrink-0 text-slate-400" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <Button
        variant="secondary"
        icon={ScanSearch}
        onClick={() => {
          onClose();
          navigate("/");
        }}
      >
        Analyse a new photo
      </Button>
    </Modal>
  );
}
