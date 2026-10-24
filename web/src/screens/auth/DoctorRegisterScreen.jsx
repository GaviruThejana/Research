import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AtSign, BadgeCheck, IdCard, Info, Lock, Send, Stethoscope, User } from "lucide-react";
import { useAuth } from "../../auth/AuthContext";
import { Button, ErrorText, PasswordField, TextField } from "../../components/ui";
import { showAlert } from "../../components/dialog";
import CountryPicker from "../../components/CountryPicker";
import { DEFAULT_COUNTRY } from "../../constants/countries";
import { friendlyMessage, showErrorAlert } from "../../utils/errors";
import { validateDoctorForm } from "./validation";

/**
 * Doctor registration (port of mobile/src/screens/auth/DoctorRegisterScreen.js).
 * Accounts start with isApproved: false; an admin verifies the license before
 * the doctor can log in or appears in the directory.
 */
export default function DoctorRegisterScreen() {
  const { registerDoctor } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    specialization: "Dermatology",
    country: DEFAULT_COUNTRY,
    licenseNumber: "",
  });
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const update = (key) => (value) => {
    const next = { ...form, [key]: value };
    setForm(next);
    // After the first attempt, re-validate as the user edits (error prevention).
    if (submitted) setFieldErrors(validateDoctorForm(next));
  };
  const onInput = (key) => (event) => update(key)(event.target.value);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitted(true);
    const payload = { ...form };
    const errors = validateDoctorForm(payload);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setIsSubmitting(true);
    setError(null);
    try {
      const trimmed = Object.fromEntries(Object.entries(payload).map(([k, v]) => [k, k === "password" ? v : v.trim()]));
      const message = await registerDoctor(trimmed);
      await showAlert("Registration Successful", message || "Registration successful. Please wait for Admin approval before logging in.");
      navigate("/login", { replace: true });
    } catch (err) {
      setError(friendlyMessage(err));
      // Server unreachable (status 0): an alert is hard to miss.
      if (!err.status) showErrorAlert("Can't connect", err);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-[28px] font-bold leading-tight tracking-tight text-ink">Register as a doctor</h1>
        <p className="mt-1.5 text-[15px] text-muted">Join the verified dermatologist directory.</p>
      </div>

      <div className="flex gap-3 rounded-2xl border border-primary/20 bg-primary-soft p-4 text-sm text-primary-deep">
        <Info size={18} className="mt-0.5 shrink-0 text-primary" aria-hidden="true" />
        <p>After you register, an administrator verifies your license. You'll be able to log in and appear in the doctor directory once approved.</p>
      </div>

      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5 rounded-2xl border border-line bg-surface p-5 shadow-card sm:p-6">
        <fieldset className="flex flex-col gap-4">
          <legend className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Your account</legend>
          <TextField label="Full name" icon={User} value={form.name} onChange={onInput("name")} error={fieldErrors.name} autoComplete="name" />
          <TextField
            label="Professional email"
            type="email"
            icon={AtSign}
            value={form.email}
            onChange={onInput("email")}
            error={fieldErrors.email}
            autoCapitalize="none"
            autoComplete="email"
            inputMode="email"
            placeholder="dr.name@hospital.org"
          />
          <PasswordField
            label="Password"
            icon={Lock}
            hint="At least 8 characters."
            value={form.password}
            onChange={onInput("password")}
            error={fieldErrors.password}
            autoComplete="new-password"
          />
        </fieldset>

        <fieldset className="flex flex-col gap-4 border-t border-line pt-5">
          <legend className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Professional details</legend>
          <TextField label="Specialization" icon={Stethoscope} value={form.specialization} onChange={onInput("specialization")} error={fieldErrors.specialization} />
          <CountryPicker label="Country you practise in" value={form.country} onChange={update("country")} error={fieldErrors.country} />
          <TextField
            label="Medical license number"
            icon={IdCard}
            hint="Checked by an administrator before approval."
            value={form.licenseNumber}
            onChange={onInput("licenseNumber")}
            error={fieldErrors.licenseNumber}
            autoCapitalize="characters"
            placeholder="e.g. SLMC 12345"
          />
        </fieldset>

        <ErrorText>{error}</ErrorText>
        <Button type="submit" icon={Send} loading={isSubmitting} loadingText="Submitting…">
          Submit for approval
        </Button>
        <p className="flex items-center justify-center gap-1.5 text-xs text-slate-500">
          <BadgeCheck size={14} aria-hidden="true" />
          Only verified doctors are shown to patients.
        </p>
      </form>
    </div>
  );
}
