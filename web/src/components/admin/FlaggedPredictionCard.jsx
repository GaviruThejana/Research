import React from "react";
import { CheckCircle2, Clock, ThumbsDown, ThumbsUp, XCircle } from "lucide-react";
import { toAppUrl } from "../../api/client";
import { Badge, Button } from "../ui";

const STATUS = {
  pending: { tone: "warning", icon: Clock, label: "Pending review" },
  approved: { tone: "success", icon: CheckCircle2, label: "Approved for training" },
  rejected: { tone: "danger", icon: XCircle, label: "Rejected" },
};

/**
 * One flagged report: image, AI prediction vs. doctor label, and actions.
 * Approve is disabled when there is no doctor label, since an approved record
 * is used as a fine-tuning sample and needs a ground-truth label.
 * (Moved here from the former frontend/ admin portal.)
 */
export default function FlaggedPredictionCard({ item, isUpdating, onApprove, onReject }) {
  const canApprove = Boolean(item.doctorLabel);
  const reporter = item.reportedBy;
  const status = STATUS[item.validationStatus] || STATUS.pending;
  const isPending = item.validationStatus === "pending";

  return (
    <li className="flex flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-card transition-shadow hover:shadow-lift">
      <div className="relative">
        <img src={toAppUrl(item.imageUrl)} alt={`Lesion reported as ${item.aiPrediction}`} loading="lazy" className="aspect-[4/3] w-full bg-subtle object-cover" />
        <Badge tone={status.tone} icon={status.icon} className="absolute left-3 top-3 shadow-sm">
          {status.label}
        </Badge>
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <dl className="grid grid-cols-2 divide-x divide-line rounded-xl border border-line text-sm">
          <div className="p-3">
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">AI prediction</dt>
            <dd className="mt-1 font-semibold text-ink">{item.aiPrediction}</dd>
          </div>
          <div className="p-3">
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Doctor label</dt>
            <dd className="mt-1 font-semibold text-primary-dark">{item.doctorLabel || <span className="font-normal text-muted">Not provided</span>}</dd>
          </div>
        </dl>
        <p className="text-xs text-muted">
          Reported by <span className="font-semibold text-ink">{reporter?.name || "unknown user"}</span>
          {reporter?.role === "doctor" && reporter?.isApproved ? " (doctor)" : ""} on {new Date(item.createdAt).toLocaleString()}
        </p>
        {isPending && !canApprove && <p className="text-xs text-amber">A doctor label is required to approve this report.</p>}
        {isPending && (
          <div className="mt-auto grid grid-cols-2 gap-2">
            <Button size="sm" variant="success" icon={ThumbsUp} onClick={() => onApprove(item._id)} disabled={isUpdating || !canApprove}>
              Approve
            </Button>
            <Button size="sm" variant="danger" icon={ThumbsDown} onClick={() => onReject(item._id)} disabled={isUpdating}>
              Reject
            </Button>
          </div>
        )}
      </div>
    </li>
  );
}
