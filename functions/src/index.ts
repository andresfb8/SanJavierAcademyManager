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
// Firestore triggers
// ---------------------------------------------------------------------------
export { onPlayerStatusChange } from "./triggers/onPlayerStatusChange";
