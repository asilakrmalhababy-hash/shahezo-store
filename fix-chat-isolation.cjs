const fs = require("fs");
const path = require("path");
const cp = require("child_process");

const root = process.cwd();
const dbFile = path.join(root, "server/commerce.ts");
const homeFile = path.join(root, "client/src/pages/Home.tsx");

function fail(message) {
  console.error("\n❌ " + message);
  process.exit(1);
}

if (!fs.existsSync(dbFile) || !fs.existsSync(homeFile)) {
  fail("لم أجد ملفات المشروع المتوقعة. تأكد أنك داخل ~/original-store");
}

let server = fs.readFileSync(dbFile, "utf8");
let home = fs.readFileSync(homeFile, "utf8");

const dangerousFallback = /const ipKey = ["']ip:["']\s*\+\s*\(ctx\.req\.ip\s*\|\|\s*["']unknown-client["']\);[\s\S]*?if\s*\(fallback\s*&&\s*\(!session\s*\|\|\s*fallback\.messages\.some\(m\s*=>\s*m\.role\s*===\s*["']owner["']\)\)\)\s*session\s*=\s*fallback\s*;/;

if (dangerousFallback.test(server)) {
  const backup = dbFile + ".backup-" + Date.now();
  fs.copyFileSync(dbFile, backup);

  server = server.replace(
    dangerousFallback,
    "/* Security fix: never fall back to another customer's chat. */"
  );

  fs.writeFileSync(dbFile, server);
  console.log("✅ أزيل ربط المحادثات الاحتياطي الخطير.");
} else if (
  server.includes('const ipKey = "ip:"') ||
  server.includes("const ipKey = 'ip:'") ||
  server.includes("liveChatsMemory.values()")
) {
  fail(
    "وجدت منطق بحث احتياطي، لكن شكله مختلف. لم أعدّل الملف حتى لا أفسد الكود. أرسل لي مقطع assistant.pollMessages من server/commerce.ts."
  );
} else {
  console.log("ℹ️ لم أجد كتلة fallback المعروفة؛ سأتحقق من وجود بحث عام داخل الملف.");
  if (/liveChatsMemory\.values\(\)[\s\S]{0,700}role\s*===\s*["']owner["']/.test(server)) {
    fail("يبدو أن هناك بحثًا عامًا عن رسائل الإدارة بصيغة مختلفة. أوقفنا التعديل الآلي لحماية المشروع.");
  }
}

const backupHome = homeFile + ".backup-" + Date.now();
fs.copyFileSync(homeFile, backupHome);

// أضف تحسينات CSS مستقلة فقط إذا لم تكن موجودة مسبقًا.
// لا نغيّر JSX بتخمين أسماء مكونات الرسائل.
const styleMarker = "/* ORIGINAL CHAT MESSAGE POLISH */";
if (!home.includes(styleMarker)) {
  const polish = `
${styleMarker}
const originalChatMessagePolish = \`
.original-chat-message {
  max-width: min(88%, 620px);
  padding: 12px 15px;
  border-radius: 18px;
  overflow-wrap: anywhere;
  word-break: normal;
  white-space: pre-wrap;
  line-height: 1.75;
  font-size: 14px;
  box-shadow: 0 2px 8px rgba(15, 23, 42, 0.06);
}
.original-chat-message--customer {
  margin-inline-start: auto;
  border-bottom-inline-end-radius: 5px;
  background: #047857;
  color: #fff;
}
.original-chat-message--staff {
  margin-inline-end: auto;
  border: 1px solid #e5e7eb;
  border-bottom-inline-start-radius: 5px;
  background: #fff;
  color: #1f2937;
}
.original-chat-message--ai {
  margin-inline-end: auto;
  border: 1px solid #d1fae5;
  border-bottom-inline-start-radius: 5px;
  background: #ecfdf5;
  color: #064e3b;
}
@media (max-width: 640px) {
  .original-chat-message { max-width: 94%; padding: 10px 12px; font-size: 13px; }
}
\`;
`;
  // لا نحقن تعريفًا في موضع عشوائي داخل TSX.
  // سنحفظ CSS في ملف مستقل كي يمكن ربطه بالمكوّن الصحيح بعد مراجعة JSX.
  const cssPath = path.join(root, "client/src/original-chat-polish.css");
  if (!fs.existsSync(cssPath)) {
    fs.writeFileSync(
      cssPath,
      polish.slice(polish.indexOf("`") + 1, polish.lastIndexOf("`")).trim() + "\n"
    );
    console.log("📝 أنشأت ملف CSS لتحسين شكل الرسائل.");
  } else {
    console.log("ℹ️ ملف تحسين الرسائل موجود مسبقًا.");
  }
}

try {
  cp.execFileSync("npm", ["run", "check"], { stdio: "inherit" });
} catch {
  console.error("\n⚠️ فشل فحص TypeScript. لم أرفع التغييرات إلى GitHub.");
  process.exit(1);
}

console.log(`
✅ انتهى فحص TypeScript.
⚠️ تحسين CSS أُنشئ كملف مستقل؛ لم يُربط تلقائيًا بواجهة الرسائل لتجنب تغيير JSX بالتخمين.
⚠️ لا تعتبر عزل المحادثات مؤكدًا قبل اختبار حسابين مختلفين.
`);
