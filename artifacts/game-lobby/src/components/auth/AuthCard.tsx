import { useId, useState, type InputHTMLAttributes, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, Loader2, Lock, Mail, UserRound } from "lucide-react";
import { AuthError, postAuth, saveSession, type AuthUser } from "@/lib/auth-api";

type Mode = "signup" | "login";

type Props = {
  onAuthenticated: (user: AuthUser) => void;
  /** Called right before a request so the click can unlock audio on mobile. */
  onBeforeSubmit?: () => void;
  onFailed?: () => void;
};

const MIN_AGE = 13;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const THIS_YEAR = new Date().getFullYear();
// Nobody born later than this can be old enough, so don't make them scroll past those years.
const YEARS = Array.from({ length: 90 }, (_, i) => String(THIS_YEAR - MIN_AGE - i));
const DAYS = Array.from({ length: 31 }, (_, i) => String(i + 1));

const emailField = z.string().trim().min(1, "Enter your email").email("That doesn't look like an email");

const loginSchema = z.object({
  email: emailField,
  password: z.string().min(1, "Enter your password"),
});

const signupSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "Pick a name the table will see")
      .max(24, "24 characters max"),
    email: emailField,
    password: z.string().min(8, "At least 8 characters").max(128, "128 characters max"),
    dobDay: z.string().min(1, "Day"),
    dobMonth: z.string().min(1, "Month"),
    dobYear: z.string().min(1, "Year"),
    terms: z.boolean().refine((v) => v, "Please accept to continue"),
  })
  .superRefine((v, ctx) => {
    if (!v.dobDay || !v.dobMonth || !v.dobYear) return;
    const y = Number(v.dobYear);
    const m = Number(v.dobMonth);
    const d = Number(v.dobDay);
    const date = new Date(Date.UTC(y, m - 1, d));
    if (date.getUTCMonth() !== m - 1) {
      ctx.addIssue({ code: "custom", path: ["dobDay"], message: "That date doesn't exist" });
      return;
    }
    const now = new Date();
    let age = now.getUTCFullYear() - y;
    if (now.getUTCMonth() < m - 1 || (now.getUTCMonth() === m - 1 && now.getUTCDate() < d)) age -= 1;
    if (age < MIN_AGE) {
      ctx.addIssue({ code: "custom", path: ["dobYear"], message: `You must be ${MIN_AGE} or older to play` });
    }
  });

type LoginValues = z.infer<typeof loginSchema>;
type SignupValues = z.infer<typeof signupSchema>;

function isoDob(v: SignupValues) {
  return `${v.dobYear}-${v.dobMonth.padStart(2, "0")}-${v.dobDay.padStart(2, "0")}`;
}

export default function AuthCard({ onAuthenticated, onBeforeSubmit, onFailed }: Props) {
  // Log in first; new players switch to Create account with one tap.
  const [mode, setMode] = useState<Mode>("login");
  const [prefillEmail, setPrefillEmail] = useState("");

  function switchTo(next: Mode, email?: string) {
    if (email !== undefined) setPrefillEmail(email);
    setMode(next);
  }

  return (
    <div className="w-full">
      <div
        role="tablist"
        aria-label="Account"
        className="grid grid-cols-2 p-1 mb-5 rounded-xl bg-black/50 ring-1 ring-white/10"
      >
        {(["signup", "login"] as const).map((m) => (
          <button
            key={m}
            role="tab"
            type="button"
            aria-selected={mode === m}
            onClick={() => switchTo(m)}
            className={`min-h-[44px] rounded-lg text-sm font-semibold tracking-wide transition-colors cursor-pointer ${
              mode === m
                ? "btn-gold"
                : "text-gray-400 hover:text-gray-200"
            }`}
          >
            {m === "signup" ? "Create account" : "Log in"}
          </button>
        ))}
      </div>

      {mode === "signup" ? (
        <SignupForm
          key="signup"
          onAuthenticated={onAuthenticated}
          onBeforeSubmit={onBeforeSubmit}
          onFailed={onFailed}
          onGoToLogin={(email) => switchTo("login", email)}
        />
      ) : (
        <LoginForm
          key="login"
          defaultEmail={prefillEmail}
          onAuthenticated={onAuthenticated}
          onBeforeSubmit={onBeforeSubmit}
          onFailed={onFailed}
          onGoToSignup={() => switchTo("signup")}
        />
      )}
    </div>
  );
}

type FormProps = Omit<Props, never>;

function LoginForm({
  defaultEmail,
  onAuthenticated,
  onBeforeSubmit,
  onFailed,
  onGoToSignup,
}: FormProps & { defaultEmail: string; onGoToSignup: () => void }) {
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: defaultEmail, password: "" },
  });

  const submit = handleSubmit(async (values) => {
    setFormError(null);
    onBeforeSubmit?.();
    try {
      const data = await postAuth<{ token: string; user: AuthUser }>("login", {
        email: values.email,
        password: values.password,
      });
      saveSession(data.token, data.user);
      onAuthenticated(data.user);
    } catch (err) {
      onFailed?.();
      const e = err as AuthError;
      setFormError(e.status === 401 ? "Wrong email or password." : e.message);
    }
  });

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4" aria-label="Log in">
      <TextField
        label="Email"
        icon={<Mail className="h-4 w-4" />}
        error={errors.email?.message}
        type="email"
        inputMode="email"
        autoComplete="email"
        autoCapitalize="none"
        spellCheck={false}
        autoFocus={!defaultEmail}
        placeholder="you@example.com"
        {...register("email")}
      />
      <PasswordField
        label="Password"
        autoComplete="current-password"
        placeholder="Your password"
        error={errors.password?.message}
        autoFocus={Boolean(defaultEmail)}
        {...register("password")}
      />
      <FormError message={formError} />
      <SubmitButton busy={isSubmitting} label="Log in" busyLabel="Logging in…" />
      <p className="text-center text-sm text-gray-400">
        New here?{" "}
        <button type="button" onClick={onGoToSignup} className="text-amber-300 hover:text-amber-200 underline underline-offset-2 cursor-pointer">
          Create an account
        </button>
      </p>
    </form>
  );
}

function SignupForm({
  onAuthenticated,
  onBeforeSubmit,
  onFailed,
  onGoToLogin,
}: FormProps & { onGoToLogin: (email: string) => void }) {
  const [formError, setFormError] = useState<ReactNode>(null);
  const {
    register,
    handleSubmit,
    getValues,
    setError,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<SignupValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: { name: "", email: "", password: "", dobDay: "", dobMonth: "", dobYear: "", terms: false },
  });

  const password = watch("password");
  const dobError = errors.dobDay?.message ?? errors.dobMonth?.message ?? errors.dobYear?.message;

  const submit = handleSubmit(async (values) => {
    setFormError(null);
    onBeforeSubmit?.();
    try {
      const data = await postAuth<{ token: string; user: AuthUser }>("signup", {
        name: values.name,
        email: values.email,
        password: values.password,
        dob: isoDob(values),
      });
      saveSession(data.token, data.user);
      onAuthenticated(data.user);
    } catch (err) {
      onFailed?.();
      const e = err as AuthError;
      if (e.status === 409) {
        setError("email", { message: "There's already an account with this email." });
        setFormError(
          <>
            Already have an account?{" "}
            <button
              type="button"
              onClick={() => onGoToLogin(getValues("email"))}
              className="text-amber-300 underline underline-offset-2 cursor-pointer"
            >
              Log in instead
            </button>
          </>,
        );
      } else if (e.status === 403) {
        setError("dobYear", { message: e.message });
      } else {
        setFormError(e.message);
      }
    }
  });

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4" aria-label="Create account">
      <TextField
        label="Display name"
        hint="What the table calls you. You can change it per room."
        icon={<UserRound className="h-4 w-4" />}
        error={errors.name?.message}
        maxLength={24}
        autoComplete="nickname"
        placeholder="Ghost"
        autoFocus
        {...register("name")}
      />
      <TextField
        label="Email"
        icon={<Mail className="h-4 w-4" />}
        error={errors.email?.message}
        type="email"
        inputMode="email"
        autoComplete="email"
        autoCapitalize="none"
        spellCheck={false}
        placeholder="you@example.com"
        {...register("email")}
      />
      <div>
        <PasswordField
          label="Password"
          autoComplete="new-password"
          placeholder="At least 8 characters"
          error={errors.password?.message}
          {...register("password")}
        />
        {!errors.password && <PasswordStrength value={password} />}
      </div>

      <fieldset>
        <legend className="mb-1.5 text-sm font-medium text-gray-300">Date of birth</legend>
        <div className="grid grid-cols-[1fr_1.2fr_1.3fr] gap-2">
          <Select aria-label="Day" invalid={Boolean(errors.dobDay)} {...register("dobDay")}>
            <option value="">Day</option>
            {DAYS.map((d) => <option key={d} value={d}>{d}</option>)}
          </Select>
          <Select aria-label="Month" invalid={Boolean(errors.dobMonth)} {...register("dobMonth")}>
            <option value="">Month</option>
            {MONTHS.map((m, i) => <option key={m} value={String(i + 1)}>{m}</option>)}
          </Select>
          <Select aria-label="Year" invalid={Boolean(errors.dobYear)} autoComplete="bday-year" {...register("dobYear")}>
            <option value="">Year</option>
            {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
          </Select>
        </div>
        {dobError ? (
          <FieldMessage error>{dobError === "Day" || dobError === "Month" || dobError === "Year" ? "Enter your full date of birth" : dobError}</FieldMessage>
        ) : (
          <FieldMessage>Players must be {MIN_AGE}+. Never shown to others.</FieldMessage>
        )}
      </fieldset>

      <div>
        <label className="flex items-start gap-3 text-sm text-gray-300 cursor-pointer select-none">
          <input
            type="checkbox"
            className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer rounded accent-amber-600"
            {...register("terms")}
          />
          <span>
            I accept the{" "}
            <a href="/terms.html" target="_blank" rel="noreferrer" className="text-amber-300 underline underline-offset-2">
              Terms
            </a>{" "}
            and{" "}
            <a href="/privacy.html" target="_blank" rel="noreferrer" className="text-amber-300 underline underline-offset-2">
              Privacy Policy
            </a>
          </span>
        </label>
        {errors.terms && <FieldMessage error>{errors.terms.message}</FieldMessage>}
      </div>

      <FormError message={formError} />
      <SubmitButton busy={isSubmitting} label="Create account" busyLabel="Creating account…" />
    </form>
  );
}

/* ---------- small building blocks ---------- */

const fieldBase =
  "w-full min-h-[50px] rounded-xl bg-black/55 text-white text-base placeholder:text-gray-400/70 ring-1 transition-shadow focus:outline-none focus:ring-2";
const ringOk = "ring-white/12 focus:ring-amber-500/70";
const ringBad = "ring-red-500/70 focus:ring-red-400";

type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: string;
  error?: string;
  icon?: ReactNode;
};

function TextField({ label, hint, error, icon, id, ...input }: TextFieldProps & { ref?: React.Ref<HTMLInputElement> }) {
  const auto = useId();
  const fieldId = id ?? auto;
  const msgId = `${fieldId}-msg`;
  return (
    <div>
      <label htmlFor={fieldId} className="mb-1.5 block text-sm font-medium text-gray-300">
        {label}
      </label>
      <div className="relative">
        {icon && (
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500">{icon}</span>
        )}
        <input
          id={fieldId}
          aria-invalid={Boolean(error)}
          aria-describedby={error || hint ? msgId : undefined}
          className={`${fieldBase} ${error ? ringBad : ringOk} ${icon ? "pl-10" : "pl-4"} pr-4`}
          {...input}
        />
      </div>
      {error ? (
        <FieldMessage id={msgId} error>{error}</FieldMessage>
      ) : hint ? (
        <FieldMessage id={msgId}>{hint}</FieldMessage>
      ) : null}
    </div>
  );
}

function PasswordField({ label, error, id, ...input }: TextFieldProps & { ref?: React.Ref<HTMLInputElement> }) {
  const [show, setShow] = useState(false);
  const auto = useId();
  const fieldId = id ?? auto;
  const msgId = `${fieldId}-msg`;
  return (
    <div>
      <label htmlFor={fieldId} className="mb-1.5 block text-sm font-medium text-gray-300">
        {label}
      </label>
      <div className="relative">
        <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500">
          <Lock className="h-4 w-4" />
        </span>
        <input
          id={fieldId}
          type={show ? "text" : "password"}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? msgId : undefined}
          autoCapitalize="none"
          spellCheck={false}
          className={`${fieldBase} ${error ? ringBad : ringOk} pl-10 pr-12`}
          {...input}
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? "Hide password" : "Show password"}
          aria-pressed={show}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-lg text-gray-400 hover:text-gray-200 cursor-pointer"
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      {error && <FieldMessage id={msgId} error>{error}</FieldMessage>}
    </div>
  );
}

function PasswordStrength({ value }: { value: string }) {
  const checks = [value.length >= 8, /[A-Za-z]/.test(value) && /\d/.test(value), value.length >= 12];
  const score = value ? checks.filter(Boolean).length : 0;
  const label = !value ? "8+ characters" : score <= 1 ? "Weak" : score === 2 ? "Good" : "Strong";
  const colors = ["bg-red-500", "bg-amber-500", "bg-emerald-500"];
  return (
    <div className="mt-2 flex items-center gap-2" aria-live="polite">
      <div className="flex flex-1 gap-1">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors ${i < score ? colors[Math.max(0, score - 1)] : "bg-white/10"}`}
          />
        ))}
      </div>
      <span className="w-20 text-right text-xs text-gray-500">{label}</span>
    </div>
  );
}

function Select({
  invalid,
  children,
  ...rest
}: React.SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean; ref?: React.Ref<HTMLSelectElement> }) {
  return (
    <select
      aria-invalid={invalid}
      className={`${fieldBase} ${invalid ? ringBad : ringOk} px-3 cursor-pointer [color-scheme:dark] appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%2212%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%239ca3af%22 stroke-width=%222%22><path d=%22m6 9 6 6 6-6%22/></svg>')] bg-no-repeat bg-[right_0.6rem_center] pr-7`}
      {...rest}
    >
      {children}
    </select>
  );
}

function FieldMessage({ children, error, id }: { children: ReactNode; error?: boolean; id?: string }) {
  return (
    <p id={id} className={`mt-1.5 text-xs ${error ? "text-red-400" : "text-gray-500"}`} role={error ? "alert" : undefined}>
      {children}
    </p>
  );
}

function FormError({ message }: { message: ReactNode }) {
  if (!message) return null;
  return (
    <div role="alert" className="rounded-xl bg-red-950/50 px-4 py-3 text-sm text-red-200 ring-1 ring-red-800/60">
      {message}
    </div>
  );
}

function SubmitButton({ busy, label, busyLabel }: { busy: boolean; label: string; busyLabel: string }) {
  return (
    <button
      type="submit"
      disabled={busy}
      className="mt-1 flex w-full min-h-[52px] items-center justify-center gap-2 rounded-xl btn-gold text-lg font-semibold disabled:cursor-wait cursor-pointer"
    >
      {busy && <Loader2 className="h-5 w-5 animate-spin" aria-hidden />}
      {busy ? busyLabel : label}
    </button>
  );
}
