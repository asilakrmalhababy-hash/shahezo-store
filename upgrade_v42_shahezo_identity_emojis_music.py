# 1. Update client/src/pages/Home.tsx
with open("client/src/pages/Home.tsx", "r", encoding="utf-8") as f:
    home = f.read()

old_faces_const = """const RATING_FACES = [
  { val: 5, emoji: "🤩", label: "رهيب" },
  { val: 4, emoji: "😊", label: "ممتاز" },
  { val: 3, emoji: "😐", label: "عادي" },
  { val: 2, emoji: "😕", label: "مقبول" },
  { val: 1, emoji: "😠", label: "سيء" },
];"""

new_faces_const = """const RATING_FACES = [
  { val: 5, emoji: "🤩", label: "رهيب" },
  { val: 4, emoji: "😊", label: "ممتاز" },
  { val: 3, emoji: "😐", label: "عادي" },
  { val: 2, emoji: "😕", label: "مقبول" },
  { val: 1, emoji: "😠", label: "سيء" },
];

function playShahezoCustomerChime() {
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate([75, 45, 115]);
    }
    const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const notes = [587.33, 739.99, 880.0, 1174.66];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.value = freq;
      const start = ctx.currentTime + idx * 0.08;
      gain.gain.setValueAtTime(0.001, start);
      gain.gain.exponentialRampToValueAtTime(0.14, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.36);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.38);
    });
  } catch {}
}

function ShahezoFaceIcon({ val, size = 28 }: { val: number; size?: number }) {
  const isGreat = val === 5;
  const isGood = val === 4;
  const isNeutral = val === 3;
  const isFair = val === 2;
  const hatColor = val >= 4 ? "#870210" : val === 3 ? "#9a7b6f" : "#6b554e";
  const bandColor = val >= 4 ? "#f1d897" : "#e5d5c8";
  const faceBg = val === 5 ? "#fff6e5" : val === 4 ? "#fff8ee" : val === 3 ? "#faf5f0" : val === 2 ? "#f6efea" : "#fdf0ee";
  const strokeColor = val <= 1 ? "#870210" : "#2b120f";

  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <path
        d="M11 14C8.5 14 7 12.2 7 10.2C7 8.1 8.8 6.5 11 6.8C12 4.8 14.3 3.5 17 3.5C18.5 3.5 19.8 4 20.8 4.8C21.8 4 23.1 3.5 24.5 3.5C27.2 3.5 29.4 4.8 30.3 6.8C32.4 6.6 34 8.2 34 10.2C34 12.2 32.4 14 30 14H11Z"
        fill={hatColor}
      />
      <rect x="11" y="12.5" width="18" height="3.2" rx="1.2" fill={bandColor} />
      <circle cx="20" cy="25.5" r="11.5" fill={faceBg} stroke={hatColor} strokeWidth="1.8" />
      {isGreat ? (
        <>
          <path d="M14.5 23.2L15.4 21.5L16.3 23.2L18 23.9L16.3 24.6L15.4 26.3L14.5 24.6L12.8 23.9Z" fill="#d97706" />
          <path d="M24.6 23.2L25.5 21.5L26.4 23.2L28.1 23.9L26.4 24.6L25.5 26.3L24.6 24.6L22.9 23.9Z" fill="#d97706" />
        </>
      ) : isGood ? (
        <>
          <path d="M13.8 24.2C14.3 22.8 16.2 22.8 16.7 24.2" stroke={strokeColor} strokeWidth="1.9" strokeLinecap="round" />
          <path d="M23.3 24.2C23.8 22.8 25.7 22.8 26.2 24.2" stroke={strokeColor} strokeWidth="1.9" strokeLinecap="round" />
        </>
      ) : isNeutral ? (
        <>
          <circle cx="15.3" cy="24" r="1.4" fill={strokeColor} />
          <circle cx="24.7" cy="24" r="1.4" fill={strokeColor} />
        </>
      ) : isFair ? (
        <>
          <path d="M13.5 22.2L17 23" stroke={strokeColor} strokeWidth="1.5" strokeLinecap="round" />
          <path d="M26.5 22.2L23 23" stroke={strokeColor} strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="15.3" cy="24.5" r="1.35" fill={strokeColor} />
          <circle cx="24.7" cy="24.5" r="1.35" fill={strokeColor} />
        </>
      ) : (
        <>
          <path d="M13.3 21.8L17.2 23.4" stroke="#870210" strokeWidth="1.7" strokeLinecap="round" />
          <path d="M26.7 21.8L22.8 23.4" stroke="#870210" strokeWidth="1.7" strokeLinecap="round" />
          <circle cx="15.3" cy="24.7" r="1.4" fill="#870210" />
          <circle cx="24.7" cy="24.7" r="1.4" fill="#870210" />
        </>
      )}
      {isGreat ? (
        <path d="M14.8 28.2C16.2 31.2 23.8 31.2 25.2 28.2Z" fill="#870210" />
      ) : isGood ? (
        <path d="M15.2 28.4C16.8 30.8 23.2 30.8 24.8 28.4" stroke="#870210" strokeWidth="1.9" strokeLinecap="round" />
      ) : isNeutral ? (
        <path d="M16 29.2H24" stroke={strokeColor} strokeWidth="1.8" strokeLinecap="round" />
      ) : isFair ? (
        <path d="M16 29.8C17.8 28.6 22.2 28.6 24 29.8" stroke={strokeColor} strokeWidth="1.7" strokeLinecap="round" />
      ) : (
        <path d="M15.5 30.8C17.2 28.2 22.8 28.2 24.5 30.8" stroke="#870210" strokeWidth="1.9" strokeLinecap="round" />
      )}
    </svg>
  );
}"""

assert old_faces_const in home, "Could not find old_faces_const"
home = home.replace(old_faces_const, new_faces_const, 1)

home = home.replace(
    '<span>{isPickup ? "الخدمة" : "الموصل"}: {faceFor(r.driverRating).emoji} {faceFor(r.driverRating).label}</span>',
    '<span style={{ display: "inline-flex", alignItems: "center", gap: "3px" }}><ShahezoFaceIcon val={r.driverRating} size={18} /> {isPickup ? "الخدمة" : "الموصل"}: {faceFor(r.driverRating).label}</span>',
    1
)
home = home.replace(
    '<span>· الجودة: {faceFor(r.qualityRating).emoji} {faceFor(r.qualityRating).label}</span>',
    '<span style={{ display: "inline-flex", alignItems: "center", gap: "3px" }}>· <ShahezoFaceIcon val={r.qualityRating} size={18} /> الجودة: {faceFor(r.qualityRating).label}</span>',
    1
)
home = home.replace(
    '<span>· المذاق: {faceFor(r.tasteRating).emoji} {faceFor(r.tasteRating).label}</span>',
    '<span style={{ display: "inline-flex", alignItems: "center", gap: "3px" }}>· <ShahezoFaceIcon val={r.tasteRating} size={18} /> المذاق: {faceFor(r.tasteRating).label}</span>',
    1
)
home = home.replace(
    '<span style={{ fontSize: "17px", lineHeight: 1.1 }}>{f.emoji}</span>',
    '<ShahezoFaceIcon val={f.val} size={28} />',
    1
)
home = home.replace(
    'toast.success("شكراً لتقييمك! رأيك يهمنا لتطوير شهيزو ❤️");',
    'playShahezoCustomerChime();\n      toast.success("شكراً لتقييمك! رأيك يهمنا لتطوير شهيزو ❤️");',
    1
)
home = home.replace(
    'toast.success("تم استلام طلبك رقم " + result.orderNumber + " بنجاح");',
    'playShahezoCustomerChime();\n      toast.success("تم استلام طلبك رقم " + result.orderNumber + " بنجاح");',
    1
)

with open("client/src/pages/Home.tsx", "w", encoding="utf-8") as f:
    f.write(home)

# 2. Update Admin.tsx with Shahezo Signature Music (Default) + Vibration
import re
with open("client/src/pages/Admin.tsx", "r", encoding="utf-8") as f:
    adm = f.read()

old_wav_fn = re.search(r'function buildKitchenRingWavUrl\(\): string \{[\s\S]*?\n\}', adm)
assert old_wav_fn, "Could not find buildKitchenRingWavUrl in Admin.tsx"

new_wav_fn = """function buildKitchenRingWavUrl(): string {
  if (__kitchenWavUrl) return __kitchenWavUrl;
  const sampleRate = 22050;
  const durationSec = 12.5; // 2.5s Shahezo Signature Branded Melody + 10.0s pause
  const numSamples = Math.floor(sampleRate * durationSec);
  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);
  const writeStr = (off: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(off + i, str.charCodeAt(i));
  };
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + numSamples * 2, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, "data");
  view.setUint32(40, numSamples * 2, true);

  const notes: Array<{ t0: number; dur: number; f: number; amp: number }> = [
    { t0: 0.00, dur: 0.24, f: 587.33, amp: 0.42 },
    { t0: 0.16, dur: 0.24, f: 739.99, amp: 0.44 },
    { t0: 0.32, dur: 0.26, f: 880.00, amp: 0.46 },
    { t0: 0.50, dur: 0.48, f: 1174.66, amp: 0.52 },
    { t0: 0.00, dur: 0.90, f: 293.66, amp: 0.24 },
    { t0: 1.05, dur: 0.22, f: 739.99, amp: 0.42 },
    { t0: 1.21, dur: 0.22, f: 880.00, amp: 0.45 },
    { t0: 1.38, dur: 0.24, f: 1174.66, amp: 0.50 },
    { t0: 1.56, dur: 0.85, f: 1479.98, amp: 0.48 },
    { t0: 1.05, dur: 1.30, f: 293.66, amp: 0.26 },
  ];

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    let mix = 0;
    if (t <= 2.55) {
      for (const n of notes) {
        if (t >= n.t0 && t <= n.t0 + n.dur) {
          const dt = t - n.t0;
          const env = Math.min(1, dt / 0.012) * Math.exp(-dt * 4.2);
          const fundamental = Math.sin(2 * Math.PI * n.f * dt);
          const overtone = Math.sin(2 * Math.PI * (n.f * 2) * dt) * 0.28 * Math.exp(-dt * 7.0);
          mix += (fundamental + overtone) * env * n.amp;
        }
      }
    }
    const boosted = Math.tanh(mix * 1.35) * 0.96;
    view.setInt16(44 + i * 2, Math.max(-32767, Math.min(32767, Math.floor(boosted * 32767))), true);
  }
  const blob = new Blob([buffer], { type: "audio/wav" });
  __kitchenWavUrl = URL.createObjectURL(blob);
  return __kitchenWavUrl;
}"""

adm = adm[:old_wav_fn.start()] + new_wav_fn + adm[old_wav_fn.end():]

old_media_start = """    const el = getKitchenAudioElement();
    if (el) {
      if (el.paused) {
        void el.play().catch(() => {});
      }
    }"""

new_media_start = """    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate([180, 90, 180, 90, 300]);
    }
    const el = getKitchenAudioElement();
    if (el) {
      if (el.paused) {
        void el.play().catch(() => {});
      }
    }"""

assert old_media_start in adm, "Could not find old_media_start in Admin.tsx"
adm = adm.replace(old_media_start, new_media_start, 1)

with open("client/src/pages/Admin.tsx", "w", encoding="utf-8") as f:
    f.write(adm)

print("✅ تم تفعيل إيموجيات شهيزو المخصصة وموسيقى شهيزو الافتراضية والاهتزاز بنجاح")
