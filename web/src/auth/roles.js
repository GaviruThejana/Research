// Role checks shared by route guards and UI. The server enforces the same
// rules (requireAdmin / requireExpert in feedback-api); these only decide
// what to show.

/** Admins approve doctor registrations. */
export const isAdmin = (user) => user?.role === "admin";

/** Admins and approved expert doctors review flagged predictions. */
export const canReviewFeedback = (user) => isAdmin(user) || (Boolean(user?.isDoctor) && Boolean(user?.isExpert));

/** Anyone who should see the admin portal at all. */
export const canUseAdminPortal = (user) => isAdmin(user) || canReviewFeedback(user);
