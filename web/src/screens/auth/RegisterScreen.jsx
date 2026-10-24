import React, { useState } from "react";
import { AtSign, Lock, User, UserPlus } from "lucide-react";
import { useAuth } from "../../auth/AuthContext";
import { Button, ErrorText, PasswordField, TextField } from "../../components/ui";
import CountryPicker from "../../components/CountryPicker";
import { DEFAULT_COUNTRY } from "../../constants/countries";
import { friendlyMessage, showErrorAlert } from "../../utils/errors";
import { validatePatientForm } from "./validation";

/**
 * Patient registration (port of mobile/src/screens/auth/RegisterScreen.js).
 * The email address is used to sign in and is CC'd on any report the patient
 * sends to a dermatologist; the country decides which doctors they're matched with.
 */
export default function RegisterScreen() {
  const { registerPatient } = useAuth();
  const [form, setForm] = useState({ name: "", emailAddress: "", password: "", country: DEFAULT_COUNTRY });
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const update = (key) => (value) => {
    const next = { ...form, [key]: value };
    setForm(next);
    // After the first attempt, re-validate as the user edits (error prevention).
    if (submitted) setFieldErrors(validatePatientForm(next));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitted(true);
    const errors = validatePatientForm(form);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setIsSubmitting(true);
    setError(null);
    try {
      await registerPatient({ ...form, name: form.name.trim(), emailAddress: form.emailAddress.trim() });
      // Logged in: the PublicOnly guard redirects to Home.
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
        <h1 className="text-[28px] font-bold leading-tight tracking-tight text-ink">Create your account</h1>
        <p className="mt-1.5 text-[15px] text-muted">Your email address is where copies of doctor consultation reports are sent.</p>
      </div>
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-5 shadow-card sm:p-6">
        <TextField
          label="Full name"
          icon={User}
          value={form.name}
          onChange={(e) => update("name")(e.target.value)}
          error={fieldErrors.name}
          autoComplete="name"
        />
        <TextField
          label="Email address"
          type="email"
          icon={AtSign}
          value={form.emailAddress}
          onChange={(e) => update("emailAddress")(e.target.value)}
          error={fieldErrors.emailAddress}
          autoCapitalize="none"
          autoComplete="email"
          inputMode="email"
          placeholder="name@example.com"
        />
        <PasswordField
          label="Password"
          icon={Lock}
          hint="At least 8 characters."
          value={form.password}
          onChange={(e) => update("password")(e.target.value)}
          error={fieldErrors.password}
          autoComplete="new-password"
        />
        <CountryPicker
          label="Country you live in"
          hint="Used to match you with dermatologists in your country."
          value={form.country}
          onChange={update("country")}
          error={fieldErrors.country}
        />
        <ErrorText>{error}</ErrorText>
        <Button type="submit" icon={UserPlus} loading={isSubmitting} loadingText="Creating account…">
          Create account
        </Button>
      </form>
    </div>
  );
}
