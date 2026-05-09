import React, { useState, useEffect, FormEvent } from "react";
import { createPortal } from "react-dom";
import { X, LogIn, UserPlus, Mail, Loader2 } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useAuthModal } from "../contexts/AuthModalContext";

type View = "signin" | "signup" | "reset";

export const AuthModal: React.FC = () => {
  const { isOpen, close: onClose } = useAuthModal();
  const { loginWithGoogle, signInWithEmail, signUpWithEmail, resetPassword } = useAuth();
  const [isSmallPhone, setIsSmallPhone] = useState(() =>
    typeof window !== "undefined" && window.matchMedia("(max-width: 479px)").matches
  );

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 479px)");
    const handler = (e: MediaQueryListEvent) => setIsSmallPhone(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const [view, setView] = useState<View>("signin");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resetSent, setResetSent] = useState(false);

  if (!isOpen) return null;

  const clearForm = () => {
    setDisplayName("");
    setEmail("");
    setPassword("");
    setError("");
    setResetSent(false);
  };

  const switchView = (next: View) => {
    clearForm();
    setView(next);
  };

  const handleClose = () => {
    clearForm();
    setView("signin");
    onClose();
  };

  const handleGoogle = async () => {
    try {
      setLoading(true);
      setError("");
      await loginWithGoogle();
      handleClose();
    } catch {
      setError("Google sign-in failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = async (e: FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError("");
      await signInWithEmail(email, password);
      handleClose();
    } catch {
      setError("Invalid email or password.");
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    try {
      setLoading(true);
      setError("");
      await signUpWithEmail(email, password, displayName.trim());
      handleClose();
    } catch (err: unknown) {
      const code = (err as { code?: string }).code;
      if (code === "auth/email-already-in-use") {
        setError("An account with this email already exists.");
      } else {
        setError("Sign-up failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async (e: FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError("");
      await resetPassword(email);
      setResetSent(true);
    } catch {
      setError("Could not send reset email. Check the address and try again.");
    } finally {
      setLoading(false);
    }
  };

  const backdropStyle: React.CSSProperties = {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.7)",
    backdropFilter: "blur(5px)",
    display: "flex",
    zIndex: "var(--z-modal)",
    // Bottom-sheet on small phones, centered card otherwise
    ...(isSmallPhone
      ? { alignItems: "flex-end", justifyContent: "stretch", padding: 0 }
      : { alignItems: "center", justifyContent: "center", padding: "16px" }),
  };

  const cardStyle: React.CSSProperties = {
    width: "100%",
    padding: "var(--space-6)",
    position: "relative",
    ...(isSmallPhone
      ? {
          maxWidth: "100%",
          borderRadius: "var(--radius-xl) var(--radius-xl) 0 0",
          paddingBottom: "calc(var(--space-6) + env(safe-area-inset-bottom))",
          maxHeight: "90dvh",
          overflowY: "auto",
        }
      : {
          maxWidth: "400px",
          borderRadius: "var(--radius-xl)",
        }),
  };

  return createPortal(
    <div onClick={handleClose} style={backdropStyle}>
      <div
        className="glass-panel"
        onClick={(e) => e.stopPropagation()}
        style={cardStyle}
      >
        {/* Close */}
        <button
          onClick={handleClose}
          style={{
            position: "absolute",
            top: "16px",
            right: "16px",
            background: "none",
            border: "none",
            color: "var(--text-secondary)",
            cursor: "pointer",
            padding: "4px",
          }}
        >
          <X size={20} />
        </button>

        {/* Header */}
        <div style={{ marginBottom: "var(--space-5)" }}>
          <h2 style={{ margin: 0, fontSize: "var(--text-xl)", fontWeight: "var(--font-bold)", color: "var(--text-primary)" }}>
            {view === "signin" && "Sign In"}
            {view === "signup" && "Create Account"}
            {view === "reset" && "Reset Password"}
          </h2>
          {view === "signin" && (
            <p style={{ margin: "4px 0 0", fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>
              Welcome back to DSEasy
            </p>
          )}
        </div>

        {/* Sign In form */}
        {view === "signin" && (
          <>
            <form onSubmit={handleSignIn} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                style={inputStyle}
              />
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={inputStyle}
              />
              {error && <p style={errorStyle}>{error}</p>}
              <button
                type="button"
                onClick={() => switchView("reset")}
                style={{ background: "none", border: "none", color: "var(--accent-primary)", cursor: "pointer", fontSize: "var(--text-xs)", textAlign: "right", padding: 0 }}
              >
                Forgot password?
              </button>
              <button type="submit" disabled={loading} style={primaryBtnStyle}>
                {loading ? <Loader2 size={16} className="animate-spin" /> : <LogIn size={16} />}
                Sign In
              </button>
            </form>

            <Divider />

            <button onClick={handleGoogle} disabled={loading} style={googleBtnStyle}>
              <GoogleIcon />
              Sign In with Google
            </button>

            <p style={footerTextStyle}>
              No account?{" "}
              <button onClick={() => switchView("signup")} style={linkBtnStyle}>Create one</button>
            </p>
          </>
        )}

        {/* Sign Up form */}
        {view === "signup" && (
          <>
            <form onSubmit={handleSignUp} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <input
                type="text"
                placeholder="Full name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
                style={inputStyle}
              />
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                style={inputStyle}
              />
              <input
                type="password"
                placeholder="Password (min. 6 characters)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={inputStyle}
              />
              {error && <p style={errorStyle}>{error}</p>}
              <button type="submit" disabled={loading} style={primaryBtnStyle}>
                {loading ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
                Create Account
              </button>
            </form>

            <Divider />

            <button onClick={handleGoogle} disabled={loading} style={googleBtnStyle}>
              <GoogleIcon />
              Sign Up with Google
            </button>

            <p style={footerTextStyle}>
              Already have an account?{" "}
              <button onClick={() => switchView("signin")} style={linkBtnStyle}>Sign in</button>
            </p>
          </>
        )}

        {/* Reset Password form */}
        {view === "reset" && (
          <>
            {resetSent ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px", textAlign: "center", padding: "8px 0" }}>
                <Mail size={36} color="var(--accent-primary)" />
                <p style={{ margin: 0, color: "var(--text-primary)", fontSize: "var(--text-sm)" }}>
                  Reset link sent to <strong>{email}</strong>. Check your inbox.
                </p>
                <button onClick={() => switchView("signin")} style={linkBtnStyle}>Back to sign in</button>
              </div>
            ) : (
              <form onSubmit={handleReset} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <p style={{ margin: "0 0 4px", fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>
                  Enter your email and we'll send you a reset link.
                </p>
                <input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  style={inputStyle}
                />
                {error && <p style={errorStyle}>{error}</p>}
                <button type="submit" disabled={loading} style={primaryBtnStyle}>
                  {loading ? <Loader2 size={16} className="animate-spin" /> : <Mail size={16} />}
                  Send Reset Link
                </button>
                <button type="button" onClick={() => switchView("signin")} style={{ ...linkBtnStyle, fontSize: "var(--text-xs)", marginTop: "4px" }}>
                  Back to sign in
                </button>
              </form>
            )}
          </>
        )}
      </div>
    </div>,
    document.body
  );
};

const Divider = () => (
  <div style={{ display: "flex", alignItems: "center", gap: "12px", margin: "16px 0" }}>
    <div style={{ flex: 1, height: "1px", background: "var(--border-subtle)" }} />
    <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>or</span>
    <div style={{ flex: 1, height: "1px", background: "var(--border-subtle)" }} />
  </div>
);

const GoogleIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
  </svg>
);

const inputStyle: React.CSSProperties = {
  padding: "10px 14px",
  background: "var(--bg-input)",
  border: "1px solid var(--border-subtle)",
  borderRadius: "var(--radius-md)",
  color: "var(--text-primary)",
  fontSize: "var(--text-sm)",
  outline: "none",
  width: "100%",
  boxSizing: "border-box",
};

const primaryBtnStyle: React.CSSProperties = {
  padding: "10px",
  background: "var(--accent-primary)",
  border: "none",
  borderRadius: "var(--radius-md)",
  color: "white",
  cursor: "pointer",
  fontWeight: "var(--font-semibold)" as React.CSSProperties["fontWeight"],
  fontSize: "var(--text-sm)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "8px",
};

const googleBtnStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px",
  background: "var(--bg-input)",
  border: "1px solid var(--border-subtle)",
  borderRadius: "var(--radius-md)",
  color: "var(--text-primary)",
  cursor: "pointer",
  fontWeight: "var(--font-medium)" as React.CSSProperties["fontWeight"],
  fontSize: "var(--text-sm)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "8px",
};

const errorStyle: React.CSSProperties = {
  margin: 0,
  fontSize: "var(--text-xs)",
  color: "var(--color-negative)",
};

const footerTextStyle: React.CSSProperties = {
  margin: "16px 0 0",
  fontSize: "var(--text-xs)",
  color: "var(--text-secondary)",
  textAlign: "center",
};

const linkBtnStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  color: "var(--accent-primary)",
  cursor: "pointer",
  fontSize: "inherit",
  padding: 0,
  textDecoration: "underline",
};
