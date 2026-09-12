import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Float, MeshTransmissionMaterial, Sparkles } from "@react-three/drei";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  Facebook,
  LockKeyhole,
  Mail,
  MoveUpRight,
  Sparkles as SparklesIcon,
  UserRound,
  X,
} from "lucide-react";
import { FormEvent, Suspense, useMemo, useState } from "react";
import * as THREE from "three";

type Mode = "login" | "signup";
type Status = "idle" | "loading" | "success";

function Orb({ position, color, scale = 1, speed = 1 }: { position: [number, number, number]; color: string; scale?: number; speed?: number }) {
  return (
    <Float speed={speed} rotationIntensity={0.35} floatIntensity={0.8} floatingRange={[-0.3, 0.3]}>
      <mesh position={position} scale={scale} castShadow>
        <icosahedronGeometry args={[1, 2]} />
        <MeshTransmissionMaterial backside samples={4} thickness={0.8} roughness={0.18} transmission={0.92} chromaticAberration={0.08} anisotropy={0.3} color={color} />
      </mesh>
    </Float>
  );
}

function Ring({ position, color, rotation }: { position: [number, number, number]; color: string; rotation: [number, number, number] }) {
  return (
    <Float speed={1.1} rotationIntensity={0.55} floatIntensity={0.5}>
      <mesh position={position} rotation={rotation}>
        <torusGeometry args={[1.05, 0.08, 16, 64]} />
        <meshStandardMaterial color={color} metalness={0.7} roughness={0.2} emissive={color} emissiveIntensity={0.18} />
      </mesh>
    </Float>
  );
}

function SceneRig() {
  const { camera } = useThree();
  useFrame(({ pointer }) => {
    camera.position.x = THREE.MathUtils.lerp(camera.position.x, pointer.x * 0.32, 0.035);
    camera.position.y = THREE.MathUtils.lerp(camera.position.y, pointer.y * 0.2, 0.035);
    camera.lookAt(0, 0, 0);
  });
  return null;
}

function BoutiqueScene() {
  return (
    <Canvas dpr={[1, 1.5]} camera={{ position: [0, 0, 6], fov: 44 }} gl={{ antialias: true, alpha: true }}>
      <Suspense fallback={null}>
        <SceneRig />
        <ambientLight intensity={0.65} />
        <directionalLight position={[3, 4, 5]} intensity={2.2} color="#f5dfc8" />
        <pointLight position={[-3, 1, 3]} intensity={9} distance={8} color="#9b8cff" />
        <pointLight position={[3, -2, 2]} intensity={7} distance={7} color="#f58b6d" />
        <Orb position={[-1.9, 0.7, 0]} color="#a99cff" scale={0.82} speed={0.8} />
        <Orb position={[1.75, -1.15, -0.5]} color="#f5a07c" scale={0.62} speed={1.15} />
        <Orb position={[0.6, 1.65, -1]} color="#e9d9c1" scale={0.42} speed={1.3} />
        <Ring position={[-0.45, -1.35, 0]} color="#d6c7ff" rotation={[0.9, 0.1, 0.4]} />
        <Ring position={[2.1, 1.15, -1.3]} color="#f3bc98" rotation={[1.2, -0.4, 0.8]} />
        <Sparkles count={70} scale={8} size={1.5} speed={0.25} color="#eee9ff" opacity={0.65} />
      </Suspense>
    </Canvas>
  );
}

const inputMotion = { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.35 } };

export default function Auth() {
  const [mode, setMode] = useState<Mode>("login");
  const [status, setStatus] = useState<Status>("idle");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [terms, setTerms] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [values, setValues] = useState({ name: "", email: "", password: "", confirm: "" });
  const [focused, setFocused] = useState("");

  const switchMode = (next: Mode) => { setMode(next); setErrors({}); setStatus("idle"); };
  const update = (key: keyof typeof values, value: string) => setValues((current) => ({ ...current, [key]: value }));

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const next: Record<string, string> = {};
    if (mode === "signup" && !values.name.trim()) next.name = "Please enter your name";
    if (!/^\S+@\S+\.\S+$/.test(values.email)) next.email = "Enter a valid email address";
    if (!values.password) next.password = "Password is required";
    if (mode === "signup" && values.password !== values.confirm) next.confirm = "Passwords do not match";
    if (mode === "signup" && !terms) next.terms = "Please accept the terms to continue";
    setErrors(next);
    if (Object.keys(next).length) return;
    setStatus("loading");
    window.setTimeout(() => setStatus("success"), 1500);
  };

  const title = mode === "login" ? "Welcome back" : "Make it yours";
  const subtitle = mode === "login" ? "Enter your details to access your studio." : "Join a considered space for beautiful digital goods.";

  return (
    <div className="auth-page">
      <div className="auth-noise" />
      <section className="auth-visual" aria-label="Amir Digital atmosphere">
        <div className="auth-scene"><BoutiqueScene /></div>
        <div className="auth-visual-overlay" />
        <div className="auth-brand"><span className="auth-brand-mark">A</span><span>amir<span className="auth-dot">.</span>digital</span></div>
        <div className="auth-visual-copy">
          <p className="auth-kicker"><span />A quieter kind of digital</p>
          <h1>Objects for<br /><em>curious minds.</em></h1>
          <p className="auth-lede">Thoughtful tools, stories and experiments for people who like to make things.</p>
          <div className="auth-quote"><div className="quote-mark">“</div><p>Everything feels intentional. Like opening a beautiful little drawer of ideas.</p><span>— Lina M., early member</span></div>
        </div>
        <div className="auth-coordinates"><span>36°48'N 10°10'E</span><span>Est. 2024</span></div>
      </section>

      <main className="auth-panel">
        <div className="auth-panel-top"><span>Member access</span><a href="/" aria-label="Close authentication"><X size={18} /></a></div>
        <motion.div className="auth-card" initial={{ opacity: 0, y: 26 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.65, delay: 0.15, ease: [0.23, 1, 0.32, 1] }}>
          <div className="auth-heading"><div className="auth-mini-symbol"><SparklesIcon size={16} /></div><p className="auth-eyebrow">Your personal edit</p><h2>{title}</h2><p>{subtitle}</p></div>
          <div className="auth-tabs" role="tablist" aria-label="Authentication mode"><motion.div className="auth-tab-pill" animate={{ x: mode === "login" ? 0 : "100%" }} transition={{ type: "spring", stiffness: 380, damping: 32 }} /><button className={mode === "login" ? "active" : ""} onClick={() => switchMode("login")} role="tab" aria-selected={mode === "login"}>Log in</button><button className={mode === "signup" ? "active" : ""} onClick={() => switchMode("signup")} role="tab" aria-selected={mode === "signup"}>Create account</button></div>

          <AnimatePresence mode="wait">
            {status === "success" ? <motion.div key="success" className="auth-success" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}><div className="success-icon"><Check size={25} /></div><h3>You’re in.</h3><p>Your space is ready. Welcome to Amir Digital.</p><button className="auth-secondary" onClick={() => { setStatus("idle"); setValues({ name: "", email: "", password: "", confirm: "" }); }}>Continue browsing <ArrowRight size={16} /></button></motion.div> : <motion.form key={mode} className="auth-form" onSubmit={submit} initial={{ opacity: 0, x: mode === "login" ? -12 : 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: mode === "login" ? 12 : -12 }} transition={{ duration: 0.22 }} noValidate>
              {mode === "signup" && <motion.div {...inputMotion}><Field id="name" label="Full name" icon={<UserRound size={17} />} type="text" value={values.name} error={errors.name} focused={focused} setFocused={setFocused} onChange={(v) => update("name", v)} autoComplete="name" /></motion.div>}
              <motion.div {...inputMotion} transition={{ ...inputMotion.transition, delay: 0.04 }}><Field id="email" label="Email address" icon={<Mail size={17} />} type="email" value={values.email} error={errors.email} focused={focused} setFocused={setFocused} onChange={(v) => update("email", v)} autoComplete="email" /></motion.div>
              <motion.div {...inputMotion} transition={{ ...inputMotion.transition, delay: 0.08 }}><Field id="password" label="Password" icon={<LockKeyhole size={17} />} type={showPassword ? "text" : "password"} value={values.password} error={errors.password} focused={focused} setFocused={setFocused} onChange={(v) => update("password", v)} autoComplete={mode === "login" ? "current-password" : "new-password"} suffix={<button type="button" className="field-action" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button>} /></motion.div>
              {mode === "signup" && <motion.div {...inputMotion} transition={{ ...inputMotion.transition, delay: 0.12 }}><Field id="confirm" label="Confirm password" icon={<LockKeyhole size={17} />} type={showPassword ? "text" : "password"} value={values.confirm} error={errors.confirm} focused={focused} setFocused={setFocused} onChange={(v) => update("confirm", v)} autoComplete="new-password" /></motion.div>}
              {mode === "login" ? <div className="form-meta"><label className="check-row"><input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /><span className="fake-check"><Check size={12} /></span>Remember me</label><button type="button" className="text-button">Forgot password?</button></div> : <label className={`check-row terms ${errors.terms ? "has-error" : ""}`}><input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} /><span className="fake-check"><Check size={12} /></span>I agree to the <button type="button" className="text-button">Terms &amp; Conditions</button></label>}
              <button className="auth-submit" type="submit" disabled={status === "loading"}>{status === "loading" ? <span className="spinner" /> : <>{mode === "login" ? "Enter your space" : "Create my account"}<MoveUpRight size={17} /></>}</button>
              <div className="auth-divider"><span>or continue with</span></div>
              <div className="social-row"><button type="button" className="social-button"><span className="google-g">G</span>Google</button><button type="button" className="social-button"><Facebook size={16} fill="currentColor" />Facebook</button></div>
            </motion.form>}
          </AnimatePresence>
          <p className="auth-switch">{mode === "login" ? "New here?" : "Already have an account?"} <button className="text-button" onClick={() => switchMode(mode === "login" ? "signup" : "login")}>{mode === "login" ? "Create an account" : "Log in instead"}</button></p>
        </motion.div>
        <p className="auth-footer">By continuing, you agree to our privacy policy.<span>© 2026 Amir Digital</span></p>
      </main>
    </div>
  );
}

function Field({ id, label, icon, type, value, error, focused, setFocused, onChange, suffix, autoComplete }: { id: string; label: string; icon: React.ReactNode; type: string; value: string; error?: string; focused: string; setFocused: (value: string) => void; onChange: (value: string) => void; suffix?: React.ReactNode; autoComplete?: string }) {
  return <div className={`field ${focused === id || value ? "is-active" : ""} ${error ? "has-error" : ""}`}><label htmlFor={id}>{label}</label><div className="field-control">{icon}<input id={id} type={type} value={value} onChange={(e) => onChange(e.target.value)} onFocus={() => setFocused(id)} onBlur={() => setFocused("")} autoComplete={autoComplete} aria-invalid={!!error} />{suffix}</div>{error && <span className="field-error">{error}</span>}</div>;
}
