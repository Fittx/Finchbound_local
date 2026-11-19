import { FeedEvent } from "./FeedEvent.js";
import { Submission } from "./Submission.js";
import { Report } from "./Report.js";
import { BlockedGuest } from "./BlockedGuest.js";
import { GuestOtp } from "./GuestOtp.js";
import { GuestVerification } from "./GuestVerification.js";
export async function initializeGuestModels() {
  await Promise.all([
    FeedEvent.createIndexes(),
    Submission.createIndexes(),
    Report.createIndexes(),
    BlockedGuest.createIndexes(),
    GuestOtp.createIndexes(),
    GuestVerification.createIndexes(),
  ]);
}
