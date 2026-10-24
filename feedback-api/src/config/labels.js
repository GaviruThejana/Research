/**
 * Canonical list of ground-truth labels a doctor may assign.
 * Keep in sync with mobile/src/constants/diseaseLabels.js.
 */
const DISEASE_LABELS = Object.freeze(["Melanoma", "BCC", "SCC", "Benign"]);

const VALIDATION_STATUSES = Object.freeze(["pending", "approved", "rejected"]);

module.exports = { DISEASE_LABELS, VALIDATION_STATUSES };
