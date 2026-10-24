import React, { useCallback, useEffect, useState } from "react";
import { MapPin, RefreshCw, UserX } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { fetchDoctorsByCountry } from "../api/doctorsApi";
import { DEFAULT_COUNTRY, countryFlag } from "../constants/countries";
import CountryPicker from "./CountryPicker";
import DoctorCard from "./DoctorCard";
import { Button, Card, EmptyState, ErrorText, SkeletonList } from "./ui";
import { friendlyMessage } from "../utils/errors";

/**
 * Lists approved doctors from the logged-in patient's country only
 * (GET /api/doctors/by-country/:country). Port of
 * mobile/src/components/CountryDoctorList.js; pull-to-refresh -> Refresh button.
 *
 * Accounts created before country was required have none, so the component
 * asks for it once and saves it to the profile.
 *
 * Props:
 *  - onSelectDoctor?: (doctor) => void   makes each card a button (selection mode)
 *  - header?: element rendered above the list
 */
export default function CountryDoctorList({ onSelectDoctor, header }) {
  const { user } = useAuth();
  const country = user?.country;

  const [doctors, setDoctors] = useState([]);
  const [isLoading, setIsLoading] = useState(Boolean(country));
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(
    async (refreshing = false) => {
      if (!country) return;
      if (refreshing) setIsRefreshing(true);
      else setIsLoading(true);
      setError(null);
      try {
        setDoctors(await fetchDoctorsByCountry(country));
      } catch (err) {
        setError(friendlyMessage(err));
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [country]
  );

  useEffect(() => {
    load();
  }, [load]);

  if (!country) return <SetCountryPrompt />;

  return (
    <div className="flex flex-col gap-4">
      {header}
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-base font-semibold text-ink">
          <MapPin size={18} className="text-muted" aria-hidden="true" />
          <span>
            Doctors in <span aria-hidden="true">{countryFlag(country)} </span>
            {country}
            {!isLoading && <span className="font-normal text-muted"> ({doctors.length})</span>}
          </span>
        </h2>
        <Button variant="ghost" size="sm" icon={RefreshCw} onClick={() => load(true)} loading={isRefreshing} disabled={isLoading}>
          Refresh
        </Button>
      </div>

      {isLoading ? (
        <SkeletonList count={3} label={`Finding doctors in ${country}`} itemClassName="h-[104px]" />
      ) : doctors.length > 0 ? (
        <ul className="flex flex-col gap-3">
          {doctors.map((doctor) => (
            <li key={doctor._id}>
              <DoctorCard doctor={doctor} onSelect={onSelectDoctor ? () => onSelectDoctor(doctor) : undefined} />
            </li>
          ))}
        </ul>
      ) : error ? (
        <div className="flex flex-col gap-3">
          <ErrorText>{error}</ErrorText>
          <Button variant="secondary" icon={RefreshCw} onClick={() => load()}>
            Try again
          </Button>
        </div>
      ) : (
        <EmptyState icon={UserX} title={`No doctors in ${country} yet`}>
          No approved doctors are registered in {country} yet. Please check back later.
        </EmptyState>
      )}
    </div>
  );
}

/** Shown when the account has no country yet. */
function SetCountryPrompt() {
  const { updateProfile } = useAuth();
  const [country, setCountry] = useState(DEFAULT_COUNTRY);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);

  const save = async (event) => {
    event.preventDefault();
    setIsSaving(true);
    setError(null);
    try {
      await updateProfile({ country });
    } catch (err) {
      setError(friendlyMessage(err));
      setIsSaving(false);
    }
  };

  return (
    <Card as="form" onSubmit={save} className="flex flex-col gap-4 p-5">
      <p className="text-[15px] text-ink">Tell us where you live so we can show doctors in your country.</p>
      <CountryPicker value={country} onChange={setCountry} />
      <ErrorText>{error}</ErrorText>
      <Button type="submit" loading={isSaving}>
        Save country
      </Button>
    </Card>
  );
}
