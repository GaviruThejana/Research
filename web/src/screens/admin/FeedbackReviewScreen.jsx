import React, { useCallback, useEffect, useState } from "react";
import { CheckCircle2, ClipboardCheck, Clock, Inbox, RefreshCw, XCircle } from "lucide-react";
import { fetchFlaggedPredictions, updateFlaggedPredictionStatus } from "../../api/adminApi";
import FlaggedPredictionCard from "../../components/admin/FlaggedPredictionCard";
import StatCard from "../../components/admin/StatCard";
import SegmentedTabs from "../../components/SegmentedTabs";
import { Button, EmptyState, ErrorText, Skeleton } from "../../components/ui";
import { friendlyMessage } from "../../utils/errors";

const STATUSES = ["pending", "approved", "rejected"];

/**
 * Admins + expert doctors: review flagged predictions. Approved items become
 * fine-tuning samples; rejected items are discarded. Past decisions can be
 * browsed with the status filter. (Moved here from the former frontend/ admin portal.)
 */
export default function FeedbackReviewScreen() {
  const [status, setStatus] = useState("pending");
  const [lists, setLists] = useState({ pending: null, approved: null, rejected: null });
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [actionError, setActionError] = useState(null);
  // IDs with an in-flight PUT, so only that card's buttons are disabled.
  const [updatingIds, setUpdatingIds] = useState(() => new Set());

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const results = await Promise.all(STATUSES.map((s) => fetchFlaggedPredictions(s)));
      setLists(Object.fromEntries(STATUSES.map((s, i) => [s, results[i]])));
    } catch (err) {
      setLoadError(friendlyMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const setUpdating = (id, isUpdating) =>
    setUpdatingIds((prev) => {
      const next = new Set(prev);
      if (isUpdating) next.add(id);
      else next.delete(id);
      return next;
    });

  const removePending = (id) => setLists((prev) => ({ ...prev, pending: prev.pending.filter((item) => item._id !== id) }));

  const handleReview = async (id, newStatus) => {
    setActionError(null);
    setUpdating(id, true);
    try {
      const updated = await updateFlaggedPredictionStatus(id, newStatus);
      // Move the item from Pending to its new list (keeping the populated reporter).
      setLists((prev) => {
        const item = prev.pending.find((p) => p._id === id);
        return {
          ...prev,
          pending: prev.pending.filter((p) => p._id !== id),
          [newStatus]: [{ ...item, ...updated, reportedBy: item?.reportedBy, validationStatus: newStatus }, ...(prev[newStatus] || [])],
        };
      });
    } catch (err) {
      // 409: someone else already reviewed it; remove it from this view too.
      if (err.status === 409) removePending(id);
      setActionError(friendlyMessage(err));
    } finally {
      setUpdating(id, false);
    }
  };

  const items = lists[status] || [];
  const count = (s) => (lists[s] ? lists[s].length : null);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard icon={Clock} label="Awaiting review" value={count("pending")} tone="warning" />
        <StatCard icon={CheckCircle2} label="Approved for training" value={count("approved")} tone="success" />
        <StatCard icon={XCircle} label="Rejected" value={count("rejected")} tone="danger" />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <SegmentedTabs
          label="Report status"
          value={status}
          onChange={setStatus}
          options={[
            { value: "pending", label: "Pending", count: count("pending") ?? undefined },
            { value: "approved", label: "Approved", count: count("approved") ?? undefined },
            { value: "rejected", label: "Rejected", count: count("rejected") ?? undefined },
          ]}
        />
        <Button variant="secondary" size="sm" icon={RefreshCw} onClick={load} loading={isLoading}>
          Refresh
        </Button>
      </div>

      {status === "pending" && <p className="-mt-3 text-sm text-muted">Approve corrected labels for fine-tuning, or reject invalid reports.</p>}

      <ErrorText>{actionError}</ErrorText>

      {loadError ? (
        <ErrorText>Failed to load reports: {loadError}</ErrorText>
      ) : isLoading ? (
        <div role="status" aria-label="Loading reports" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-80 rounded-2xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState icon={status === "pending" ? ClipboardCheck : Inbox} title={status === "pending" ? "The queue is clear" : `No ${status} reports`}>
          {status === "pending" ? "No reports are waiting for review." : "Reviewed reports will appear here."}
        </EmptyState>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <FlaggedPredictionCard
              key={item._id}
              item={item}
              isUpdating={updatingIds.has(item._id)}
              onApprove={(id) => handleReview(id, "approved")}
              onReject={(id) => handleReview(id, "rejected")}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
