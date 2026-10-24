import React, { useState } from "react";
import { Link } from "react-router-dom";
import { AtSign, Lock, LogIn, Stethoscope, UserPlus } from "lucide-react";
import { useAuth } from "../../auth/AuthContext";
import { Button, ErrorText, PasswordField, TextField } from "../../components/ui";
import { showAlert } from "../../components/dialog";
import { friendlyMessage, showErrorAlert } from "../../utils/errors";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validate(email, password) {
  const errors = {};
  if (!email.trim()) errors.email = "Enter your email address.";
  else if (!EMAIL_PATTERN.test(email.trim())) errors.email = "Enter a valid email address, e.g. name@example.com.";
  if (!password) errors.password = "Enter your password.";
  return errors;
}

/** Port of mobile/src/screens/auth/LoginScreen.js */
export default function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // After the first attempt, re-validate as the user types (error prevention).
  const revalidate = (nextEmail, nextPassword) => submitted && setFieldErrors(validate(nextEmail, nextPassword));

  const handleLogin = async (event) => {
    event.preventDefault();
    setSubmitted(true);
    const errors = validate(email, password);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setIsSubmitting(true);
    setError(null);
    try {
      await login(email.trim(), password);
      // The PublicOnly guard redirects to the app as soon as the token is set.
    } catch (err) {
      const msg = friendlyMessage(err, "Login failed. Please try again.");
      setError(msg);
      // Server unreachable (status 0): an alert is hard to miss.
      if (!err.status) showErrorAlert("Can't connect", err);
      // Gracefully handle doctor pending admin approval
      if (msg.toLowerCase().includes("approval")) {
        showAlert(
          "Pending Admin Approval",
          "Your doctor account is awaiting administrative verification. You will be able to log in once your medical license is approved."
        );
      }
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-[28px] font-bold leading-tight tracking-tight text-ink">Welcome back</h1>
        <p className="mt-1.5 text-[15px] text-muted">Sign in to analyse skin lesions and consult dermatologists.</p>
      </div>

      <form onSubmit={handleLogin} noValidate className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-5 shadow-card sm:p-6">
        <TextField
          label="Email address"
          type="email"
          icon={AtSign}
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            revalidate(e.target.value, password);
          }}
          error={fieldErrors.email}
          autoCapitalize="none"
          autoComplete="email"
          inputMode="email"
          placeholder="name@example.com"
        />
        <PasswordField
          label="Password"
          icon={Lock}
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            revalidate(email, e.target.value);
          }}
          error={fieldErrors.password}
          autoComplete="current-password"
        />
        <ErrorText>{error}</ErrorText>
        <Button type="submit" icon={LogIn} loading={isSubmitting} loadingText="Signing in…">
          Login
        </Button>
      </form>

      <div className="grid gap-3 sm:grid-cols-2">
        <Link
          to="/register"
          className="flex min-h-14 items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3 text-sm shadow-card transition-all hover:border-primary/40 hover:shadow-lift"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
            <UserPlus size={18} aria-hidden="true" />
          </span>
          <span>
            <span className="block font-semibold text-ink">Register as Patient</span>
            <span className="block text-muted">Create a free account</span>
          </span>
        </Link>
        <Link
          to="/register/doctor"
          className="flex min-h-14 items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3 text-sm shadow-card transition-all hover:border-accent/40 hover:shadow-lift"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
            <Stethoscope size={18} aria-hidden="true" />
          </span>
          <span>
            <span className="block font-semibold text-ink">Register as Doctor</span>
            <span className="block text-muted">Requires admin approval</span>
          </span>
        </Link>
      </div>
    </div>
  );
}
