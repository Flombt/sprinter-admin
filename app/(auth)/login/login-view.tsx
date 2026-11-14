'use client';

import { ArrowLeftIcon, KeyRoundIcon, LockIcon, MailIcon, ShieldCheckIcon } from 'lucide-react';
import { useCallback, useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { CorrelationId } from '@/components/states/states';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ApiError, isApiError, postJson } from '@/lib/rpc/client';
import { errorMessage } from '@/lib/rpc/errors';
import { clearClientSessionState } from '@/lib/client-session';
import { hardNavigate } from '@/lib/navigation';

export type LoginNotice = 'inactivite' | 'expiree' | 'acces';
type Step = 'email' | 'code' | 'mfa_enroll' | 'mfa_challenge';

const NOTICE_TEXT: Record<LoginNotice, string> = {
  inactivite: 'Vous avez été déconnecté après 30 minutes d’inactivité.',
  expiree: 'Votre session a expiré. Reconnectez-vous.',
  acces: 'Accès refusé.',
};

const STEP_LABEL: Record<Step, string> = {
  email: 'Étape 1 sur 3 · Adresse e-mail',
  code: 'Étape 2 sur 3 · Code reçu par e-mail',
  mfa_enroll: 'Étape 3 sur 3 · Configurer l’application d’authentification',
  mfa_challenge: 'Étape 3 sur 3 · Code de l’application d’authentification',
};

const RESEND_DELAY_S = 60;

/**
 * Connexion en trois temps (§10.2) : e-mail → code à 6 chiffres (sans création de compte) →
 * TOTP (enrôlement obligatoire la première fois, puis défi à chaque session).
 */
export function LoginView({ initialStep, notice, next }: { initialStep: Step; notice: LoginNotice | null; next: string }) {
  const [step, setStep] = useState<Step>(initialStep);
  const [email, setEmail] = useState('');
  const [error, setError] = useState<ApiError | null>(null);
  const [denied, setDenied] = useState(notice === 'acces');

  // Aucun état de la session précédente (motif d'accès…) ne survit au retour à la connexion.
  useEffect(() => clearClientSessionState(), []);

  const goTo = useCallback((nextStep: Step) => {
    setError(null);
    setStep(nextStep);
  }, []);

  const fail = useCallback((err: unknown) => {
    const apiError = isApiError(err) ? err : new ApiError('unknown', 0);
    if (apiError.code === 'access_denied' || apiError.code === 'forbidden') {
      setDenied(true);
      setStep('email');
      setError(null);
      return;
    }
    setError(apiError);
  }, []);

  return (
    <main className="flex min-h-dvh items-center justify-center bg-canvas px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-3">
          <span aria-hidden="true" className="flex size-9 items-center justify-center rounded-lg bg-accent text-base font-bold text-on-accent">
            S
          </span>
          <div>
            <p className="text-md font-semibold text-fg">Sprinter Admin</p>
            <p className="text-sm text-fg-muted">Accès réservé aux administrateurs</p>
          </div>
        </div>

        <section className="rounded-lg border border-line bg-surface p-6 shadow-card" aria-labelledby="login-title">
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-fg-muted">{STEP_LABEL[step]}</p>
          <h1 id="login-title" className="mb-4 text-lg font-semibold text-fg">
            {step === 'email' ? 'Connexion' : step === 'code' ? 'Vérifiez vos e-mails' : step === 'mfa_enroll' ? 'Double authentification' : 'Code de vérification'}
          </h1>

          {denied ? (
            <Banner tone="danger" icon={<LockIcon />}>
              Accès refusé.
            </Banner>
          ) : notice && notice !== 'acces' && step === 'email' ? (
            <Banner tone="neutral">{NOTICE_TEXT[notice]}</Banner>
          ) : null}

          {step === 'email' ? (
            <EmailStep
              onSent={(value) => {
                setDenied(false);
                setEmail(value);
                goTo('code');
              }}
              onError={fail}
            />
          ) : null}
          {step === 'code' ? (
            <CodeStep
              email={email}
              onVerified={(nextStep) => goTo(nextStep)}
              onBack={() => goTo('email')}
              onError={fail}
            />
          ) : null}
          {step === 'mfa_enroll' ? <EnrollStep next={next} onError={fail} /> : null}
          {step === 'mfa_challenge' ? <ChallengeStep next={next} onError={fail} /> : null}

          {error ? (
            <div role="alert" className="mt-4 flex flex-col gap-1 rounded-md border border-danger/40 bg-danger-soft px-3 py-2">
              <p className="text-sm text-danger">{errorMessage(error.code)}</p>
              <CorrelationId id={error.correlationId} />
            </div>
          ) : null}

          {step === 'mfa_enroll' || step === 'mfa_challenge' ? (
            <button
              type="button"
              className="mt-5 text-sm text-fg-muted underline-offset-4 hover:text-fg hover:underline"
              onClick={() => {
                void postJson('/api/auth/logout', {}).finally(() => hardNavigate('/login'));
              }}
            >
              Utiliser une autre adresse
            </button>
          ) : null}
        </section>
      </div>
    </main>
  );
}

function Banner({ tone, icon, children }: { tone: 'danger' | 'neutral'; icon?: ReactNode; children: ReactNode }) {
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={
        tone === 'danger'
          ? 'mb-4 flex items-center gap-2 rounded-md border border-danger/40 bg-danger-soft px-3 py-2 text-sm text-danger [&_svg]:size-4'
          : 'mb-4 flex items-center gap-2 rounded-md border border-line bg-surface-2 px-3 py-2 text-sm text-fg [&_svg]:size-4'
      }
    >
      {icon}
      <span>{children}</span>
    </div>
  );
}

function EmailStep({ onSent, onError }: { onSent: (email: string) => void; onError: (error: unknown) => void }) {
  const id = useId();
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const email = value.trim();
    if (!email) return;
    setBusy(true);
    try {
      await postJson('/api/auth/otp', { email });
      onSent(email);
    } catch (err) {
      onError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={submit}>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={id}>Adresse e-mail</Label>
        <Input
          id={id}
          type="email"
          name="email"
          autoComplete="username"
          inputMode="email"
          required
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
      </div>
      <Button type="submit" variant="primary" disabled={busy}>
        <MailIcon aria-hidden="true" />
        {busy ? 'Envoi…' : 'Recevoir un code'}
      </Button>
      <p className="text-xs text-fg-muted">Aucun compte n’est créé depuis ce site.</p>
    </form>
  );
}

function OtpInput({ id, value, onChange, describedBy }: { id: string; value: string; onChange: (value: string) => void; describedBy?: string }) {
  return (
    <Input
      id={id}
      name="code"
      inputMode="numeric"
      autoComplete="one-time-code"
      pattern="[0-9]{6}"
      maxLength={6}
      required
      autoFocus
      aria-describedby={describedBy}
      className="h-11 text-center font-mono text-lg tracking-[0.5em]"
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
    />
  );
}

function CodeStep({
  email,
  onVerified,
  onBack,
  onError,
}: {
  email: string;
  onVerified: (step: 'mfa_enroll' | 'mfa_challenge') => void;
  onBack: () => void;
  onError: (error: unknown) => void;
}) {
  const id = useId();
  const hintId = useId();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(RESEND_DELAY_S);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (code.length !== 6) return;
    setBusy(true);
    try {
      const result = await postJson<{ next: 'mfa_enroll' | 'mfa_challenge' }>('/api/auth/verify', { email, code });
      onVerified(result.next);
    } catch (err) {
      setCode('');
      onError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={submit}>
      <p id={hintId} className="text-sm text-fg-muted">
        Si cette adresse est autorisée, un code à 6 chiffres vient d’y être envoyé. Il expire après quelques minutes.
      </p>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={id}>Code reçu par e-mail</Label>
        <OtpInput id={id} value={code} onChange={setCode} describedBy={hintId} />
      </div>
      <Button type="submit" variant="primary" disabled={busy || code.length !== 6}>
        {busy ? 'Vérification…' : 'Valider le code'}
      </Button>
      <div className="flex items-center justify-between text-sm">
        <Button variant="link" size="sm" onClick={onBack}>
          <ArrowLeftIcon aria-hidden="true" />
          Changer d’adresse
        </Button>
        <Button
          variant="link"
          size="sm"
          disabled={cooldown > 0}
          onClick={() => {
            setCooldown(RESEND_DELAY_S);
            void postJson('/api/auth/otp', { email }).catch(onError);
          }}
        >
          {cooldown > 0 ? `Renvoyer (${cooldown} s)` : 'Renvoyer le code'}
        </Button>
      </div>
    </form>
  );
}

async function completeMfa(code: string, next: string, factorId?: string): Promise<void> {
  const result = await postJson<{ ok: true; next: string }>('/api/auth/mfa/verify', { code, next, ...(factorId ? { factorId } : {}) });
  hardNavigate(result.next);
}

function EnrollStep({ next, onError }: { next: string; onError: (error: unknown) => void }) {
  const id = useId();
  const [enrollment, setEnrollment] = useState<{ factorId: string; qrCode: string; secret: string } | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    postJson<{ factorId: string; qrCode: string; secret: string }>('/api/auth/mfa/enroll', {}).then(setEnrollment, onError);
  }, [onError]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!enrollment || code.length !== 6) return;
    setBusy(true);
    try {
      await completeMfa(code, next, enrollment.factorId);
    } catch (err) {
      setCode('');
      onError(err);
      setBusy(false);
    }
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={submit}>
      <p className="text-sm text-fg-muted">
        La double authentification est obligatoire. Scannez ce QR code avec votre application d’authentification (TOTP), puis saisissez le code
        affiché.
      </p>
      <div className="flex justify-center">
        {enrollment ? (
          // eslint-disable-next-line @next/next/no-img-element -- URI de données SVG fournie par Supabase Auth
          <img src={enrollment.qrCode} alt="QR code d’enrôlement TOTP" width={176} height={176} className="size-44 rounded-md bg-white p-2" />
        ) : (
          <div className="size-44 animate-shimmer rounded-md bg-surface-2" aria-hidden="true" />
        )}
      </div>
      {enrollment ? (
        <p className="text-center text-xs text-fg-muted">
          Saisie manuelle : <code className="break-all font-mono text-fg">{enrollment.secret}</code>
        </p>
      ) : null}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={id}>Code à 6 chiffres</Label>
        <OtpInput id={id} value={code} onChange={setCode} />
      </div>
      <Button type="submit" variant="primary" disabled={!enrollment || busy || code.length !== 6}>
        <ShieldCheckIcon aria-hidden="true" />
        {busy ? 'Vérification…' : 'Activer et continuer'}
      </Button>
    </form>
  );
}

function ChallengeStep({ next, onError }: { next: string; onError: (error: unknown) => void }) {
  const id = useId();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (code.length !== 6) return;
    setBusy(true);
    try {
      await completeMfa(code, next);
    } catch (err) {
      setCode('');
      onError(err);
      setBusy(false);
    }
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={submit}>
      <p className="text-sm text-fg-muted">Saisissez le code affiché par votre application d’authentification.</p>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={id}>Code à 6 chiffres</Label>
        <OtpInput id={id} value={code} onChange={setCode} />
      </div>
      <Button type="submit" variant="primary" disabled={busy || code.length !== 6}>
        <KeyRoundIcon aria-hidden="true" />
        {busy ? 'Vérification…' : 'Se connecter'}
      </Button>
    </form>
  );
}
