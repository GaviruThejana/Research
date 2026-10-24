/**
 * Import function triggers from their respective submodules:
 *
 * const {onCall} = require("firebase-functions/v2/https");
 * const {onDocumentWritten} = require("firebase-functions/v2/firestore");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

const {setGlobalOptions} = require("firebase-functions");
const {onRequest} = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");

// For cost control, you can set the maximum number of containers that can be
// running at the same time. This helps mitigate the impact of unexpected
// traffic spikes by instead downgrading performance.
setGlobalOptions({ maxInstances: 10 });

// ඔබගේ ප්‍රධාන Express app එක මෙහි Require කරගනු ලැබේ 
// (සටහන: ඔබේ ප්‍රධාන backend ෆයිල් එක server.js නම් '../server.js' ලෙසත්, index.js නම් '../index.js' ලෙසත් දෙන්න)
const app = require("../server.js"); 

// Firebase Cloud Function එකක් ලෙස API එක Export කිරීම
exports.api = onRequest(app);