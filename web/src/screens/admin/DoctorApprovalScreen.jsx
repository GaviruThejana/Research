import React, { useCallback, useEffect, useState } from "react";
import { BadgeCheck, CheckCircle2, Clock, RefreshCw, Users, UserCheck } from "lucide-react";
import { approveDoctor, fetchDoctorRegistrations } from "../../api/adminApi";
import StatCard from "../../components/admin/StatCard";
import SegmentedTabs from "../../components/SegmentedTabs";
import { Badge, Button, EmptyState, ErrorText, SkeletonList } from "../../components/ui";
import { countryFlag } from "../../constants/countries";
import { friendlyMessage } from "../../utils/errors";

/**
 * Admin only: doctor registrations. Approving sets isApproved: true, so the
 * doctor can log in and appears in the directory.
 * Desktop: table; phones: cards. (Moved here from the former frontend/ admin portal.)
 */
export default function DoctorApprovalScreen() {
  const [status, setStatus] = useState("pending");
  const [doctors, setDoctors] = useState([]);
  const [counts, setCounts] = useState({ pending: null, approved: null });
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [approvingId, setApprovingId] = useState(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const [pending, approved] = await Promise.all([fetchDoctorRegistrations("pending"), fetchDoctorRegistrations("approved")]);
      setCounts({ pending: pending.length, approved: approved.length });
      setDoctors(status === "pending" ? pending : approved);
    } catch (err) {
      setLoadError(friendlyMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [status]);

  useEffect(() => {
    load();
  }, [load]);

  const handleApprove = async (doctor) => {
    setActionError(null);
    setApprovingId(doctor._id);
    try {
      await approveDoctor(doctor._id);
      setDoctors((prev) => prev.filter((d) => d._id !== doctor._id));
      setCounts((c) => ({ pending: c.pending - 1, approved: c.approved + 1 }));
    } catch (err) {
      // 409: already approved by another admin; it no longer belongs here.
      if (err.status === 409) setDoctors((prev) => prev.filter((d) => d._id !== doctor._id));
      setActionError(`${doctor.name}: ${friendlyMessage(err)}`);
    } finally {
      setApprovingId(null);
    }
  };

  const total = counts.pending === null ? null : counts.pending + counts.approved;
  const isPendingView = status === "pending";

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard icon={Clock} label="Awaiting approval" value={counts.pending} tone="warning" />
        <StatCard icon={UserCheck} label="Approved doctors" value={counts.approved} tone="success" />
        <StatCard icon={Users} label="Total registrations" value={total} tone="info" />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <SegmentedTabs
          label="Registration status"
          value={status}
          onChange={setStatus}
          options={[
            { value: "pending", label: "Pending", count: counts.pending ?? undefined },
            { value: "approved", label: "Approved", count: counts.approved ?? undefined },
          ]}
        />
        <Button variant="secondary" size="sm" icon={RefreshCw} onClick={load} loading={isLoading}>
          Refresh
        </Button>
      </div>

      {isPendingView && <p className="-mt-3 text-sm text-muted">Verify each license number with the medical council before approving.</p>}

      <ErrorText>{actionError}</ErrorText>

      {loadError ? (
        <ErrorText>Failed to load registrations: {loadError}</ErrorText>
      ) : isLoading ? (
        <SkeletonList count={3} label="Loading registrations" itemClassName="h-16" />
      ) : doctors.length === 0 ? (
        <EmptyState icon={isPendingView ? CheckCircle2 : Users} title={isPendingView ? "No pending registrations" : "No approved doctors yet"}>
          {isPendingView ? "You're all caught up. New doctor sign-ups will appear here." : "Approved doctors appear here and in the patient directory."}
        </EmptyState>
      ) : (
        <>
          {/* Desktop: table */}
          <div className="hidden overflow-hidden rounded-2xl border border-line bg-surface shadow-card md:block">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">{isPendingView ? "Pending doctor registrations" : "Approved doctors"}</caption>
              <thead className="border-b border-line bg-canvas text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th scope="col" className="px-4 py-3">Doctor</th>
                  <th scope="col" className="px-4 py-3">Specialization</th>
                  <th scope="col" className="px-4 py-3">Country</th>
                  <th scope="col" className="px-4 py-3">License no.</th>
                  <th scope="col" className="px-4 py-3">{isPendingView ? "Registered" : "Approved"}</th>
                  <th scope="col" className="px-4 py-3 text-right">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {doctors.map((doctor) => (
                  <tr key={doctor._id} className="transition-colors hover:bg-canvas">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-ink">{doctor.name}</p>
                      <p className="break-all text-muted">{doctor.email}</p>
                    </td>
                    <td className="px-4 py-3 text-ink">{doctor.specialization}</td>
                    <td className="px-4 py-3 text-ink">
                      <span aria-hidden="true">{countryFlag(doctor.country)} </span>
                      {doctor.country}
                    </td>
                    <td className="px-4 py-3 font-mono text-ink">{doctor.licenseNumber}</td>
                    <td className="px-4 py-3 text-muted">{new Date(isPendingView ? doctor.createdAt : doctor.approvedAt || doctor.createdAt).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-right">
                      {isPendingView ? (
                        <Button size="sm" variant="success" icon={BadgeCheck} onClick={() => handleApprove(doctor)} loading={approvingId === doctor._id} disabled={Boolean(approvingId)}>
                          Approve
                        </Button>
                      ) : (
                        <Badge tone="success" icon={BadgeCheck}>
                          Approved
                        </Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Phones: cards */}
          <ul className="flex flex-col gap-3 md:hidden">
            {doctors.map((doctor) => (
              <li key={doctor._id} className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4 shadow-card">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[17px] font-bold text-ink">{doctor.name}</p>
                    <p className="break-all text-sm text-muted">{doctor.email}</p>
                  </div>
                  <Badge tone={doctor.locationCategory === "local" ? "accent" : "info"}>{doctor.locationCategory === "local" ? "Local" : "International"}</Badge>
                </div>
                <dl className="grid grid-cols-[auto,1fr] gap-x-3 gap-y-1 text-sm">
                  <dt className="text-muted">Specialization</dt>
                  <dd className="text-ink">{doctor.specialization}</dd>
                  <dt className="text-muted">Country</dt>
                  <dd className="text-ink">
                    <span aria-hidden="true">{countryFlag(doctor.country)} </span>
                    {doctor.country}
                  </dd>
                  <dt className="text-muted">License no.</dt>
                  <dd className="font-mono text-ink">{doctor.licenseNumber}</dd>
                  <dt className="text-muted">Registered</dt>
                  <dd className="text-ink">{new Date(doctor.createdAt).toLocaleDateString()}</dd>
                </dl>
                {isPendingView ? (
                  <Button variant="success" icon={BadgeCheck} onClick={() => handleApprove(doctor)} loading={approvingId === doctor._id} disabled={Boolean(approvingId)}>
                    Approve
                  </Button>
                ) : (
                  <Badge tone="success" icon={BadgeCheck} className="self-start">
                    Approved
                  </Badge>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
