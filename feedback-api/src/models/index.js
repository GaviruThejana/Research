// Requiring this registers every model, including the Patient/Doctor
// discriminators, so User queries hydrate documents with the right schema.
const User = require("./User");
const Patient = require("./Patient");
const Doctor = require("./Doctor");
const Consultation = require("./Consultation");
const FlaggedPrediction = require("./FlaggedPrediction");
const Prediction = require("./Prediction");

module.exports = { User, Patient, Doctor, Consultation, FlaggedPrediction, Prediction };
