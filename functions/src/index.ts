import { initializeApp } from "firebase-admin/app";

// ---------------------------------------------------------------------------
// Initialize Firebase Admin SDK (must happen before any other imports that
// use Firestore, Auth, etc.)
// ---------------------------------------------------------------------------
initializeApp();

// ---------------------------------------------------------------------------
// Billing functions
// ---------------------------------------------------------------------------
export {
  generateMonthlyReceiptsScheduled,
  generateMonthlyReceiptsCallable,
} from "./billing/generateMonthlyReceipts";

// ---------------------------------------------------------------------------
// Invoicing functions
// ---------------------------------------------------------------------------
export { generateMonthlyInvoices } from "./invoicing/generateMonthlyInvoices";

// ---------------------------------------------------------------------------
// Analytics functions
// ---------------------------------------------------------------------------
export {
  generateMetricSnapshotScheduled,
  generateMetricSnapshotCallable,
} from "./analytics/generateMetricSnapshot";

// ---------------------------------------------------------------------------
// Firestore triggers
// ---------------------------------------------------------------------------
export { onPlayerStatusChange } from "./triggers/onPlayerStatusChange";
export { onUserCreated } from "./triggers/onUserCreate";

// ---------------------------------------------------------------------------
// Push notifications
// ---------------------------------------------------------------------------
export { onAttendanceNoticeCreated } from "./notifications/onAttendanceNotice";
export { classRemindersScheduled } from "./notifications/classReminders";
export { onPaymentCreated } from "./notifications/onPaymentCreated";
export { paymentReminderDay15 } from "./notifications/paymentReminder";
export { onCancelledClassCreated } from "./notifications/onCancelledClass";
