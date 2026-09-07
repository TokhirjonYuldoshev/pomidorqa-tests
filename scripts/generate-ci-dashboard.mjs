import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const env = process.env;
const outDir = resolve(env.DASHBOARD_DIR || "ci-dashboard");

const escapeXml = (value = "") =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");

const statusMeta = (status) => {
  switch (status) {
    case "success":
      return { icon: "✓", label: "Успешно", color: "#3fb950", bg: "#153a24" };
    case "failure":
      return { icon: "×", label: "Ошибка", color: "#f85149", bg: "#431d1d" };
    case "cancelled":
      return { icon: "■", label: "Отменено", color: "#d29922", bg: "#3b2d12" };
    case "skipped":
      return { icon: "–", label: "Пропущено", color: "#8b949e", bg: "#30363d" };
    default:
      return { icon: "?", label: status || "Неизвестно", color: "#8b949e", bg: "#30363d" };
  }
};

const checks = [
  ["ESLint + TypeScript", env.QUALITY || "unknown"],
  ["Unit", env.UNIT || "unknown"],
  ["API", env.API || "unknown"],
  ["E2E / Chromium", env.E2E || "unknown"],
];

const allSuccess = checks.every(([, status]) => status === "success");
const anyFailure = checks.some(([, status]) => status === "failure");
const anyCancelled = checks.some(([, status]) => status === "cancelled");

const overall = allSuccess
  ? { icon: "✓", title: "Все проверки пройдены", subtitle: "Готово к слиянию", color: "#3fb950", bg: "#123823" }
  : anyFailure
    ? { icon: "×", title: "Есть ошибки", subtitle: "Проверьте логи запуска", color: "#f85149", bg: "#431d1d" }
    : anyCancelled
      ? { icon: "■", title: "Запуск отменён", subtitle: "Pipeline был остановлен", color: "#d29922", bg: "#3b2d12" }
      : { icon: "!", title: "Проверки завершены не полностью", subtitle: "Часть этапов пропущена", color: "#d29922", bg: "#3b2d12" };

const repository = env.GITHUB_REPOSITORY || "TokhirjonYuldoshev/pomidorqa-course-tests";
const branch = env.GITHUB_HEAD_REF || env.GITHUB_REF_NAME || "main";
const actor = env.GITHUB_ACTOR || "TokhirjonYuldoshev";
const eventName = env.GITHUB_EVENT_NAME || "workflow_dispatch";
const runNumber = env.GITHUB_RUN_NUMBER || "—";
const runId = env.GITHUB_RUN_ID || "—";
const serverUrl = env.GITHUB_SERVER_URL || "https://github.com";
const runUrl = `${serverUrl}/${repository}/actions/runs/${runId}`;
const cacheHit = env.CACHE_HIT || "n/a";

const eventLabel = {
  pull_request: "Pull Request",
  push: "Push в репозиторий",
  workflow_dispatch: "Ручной запуск",
}[eventName] || eventName;

const rows = checks
  .map(([name, status], index) => {
    const meta = statusMeta(status);
    const y = 322 + index * 72;
    return `
      <line x1="66" y1="${y + 45}" x2="548" y2="${y + 45}" stroke="#30363d"/>
      <text x="90" y="${y}" class="rowText">${escapeXml(name)}</text>
      <circle cx="386" cy="${y - 7}" r="16" fill="${meta.color}"/>
      <text x="386" y="${y - 1}" text-anchor="middle" class="checkIcon">${meta.icon}</text>
      <text x="420" y="${y}" class="statusText" fill="${meta.color}">${escapeXml(meta.label)}</text>`;
  })
  .join("");

const telegramRows = checks
  .map(([name, status], index) => {
    const meta = statusMeta(status);
    const y = 505 + index * 38;
    return `
      <text x="1166" y="${y}" class="tgText">• ${escapeXml(name)}</text>
      <text x="1436" y="${y}" text-anchor="end" class="tgStatus" fill="${meta.color}">${meta.icon} ${escapeXml(meta.label)}</text>`;
  })
  .join("");

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 1600 900" role="img" aria-labelledby="title desc">
  <title id="title">PomidorQA CI Dashboard</title>
  <desc id="desc">Динамический отчёт GitHub Actions с результатами Quality, Unit, API, E2E и Telegram-уведомлением.</desc>
  <defs>
    <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0" stop-color="#070b12"/>
      <stop offset="1" stop-color="#0d1522"/>
    </linearGradient>
    <linearGradient id="card" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0" stop-color="#0d1622"/>
      <stop offset="1" stop-color="#111d2c"/>
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="10" stdDeviation="14" flood-color="#000000" flood-opacity="0.35"/>
    </filter>
    <style>
      text { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif; }
      .muted { fill: #8b949e; font-size: 18px; }
      .title { fill: #f0f6fc; font-size: 34px; font-weight: 700; }
      .subtitle { fill: #b1bac4; font-size: 19px; }
      .section { fill: #f0f6fc; font-size: 23px; font-weight: 700; }
      .rowText { fill: #e6edf3; font-size: 19px; }
      .statusText { font-size: 18px; font-weight: 650; }
      .checkIcon { fill: #ffffff; font-size: 20px; font-weight: 800; dominant-baseline: middle; }
      .env { fill: #d0d7de; font-size: 18px; }
      .tgText { fill: #d0d7de; font-size: 16px; }
      .tgStatus { font-size: 15px; font-weight: 650; }
      .tgMeta { fill: #b1bac4; font-size: 16px; }
      .link { fill: #58a6ff; font-size: 16px; }
    </style>
  </defs>

  <rect width="1600" height="900" fill="url(#bg)"/>

  <!-- GitHub dashboard -->
  <rect x="30" y="28" width="980" height="844" rx="22" fill="url(#card)" stroke="#2d3947" filter="url(#shadow)"/>
  <text x="66" y="74" class="muted">◉ GitHub Actions</text>
  <text x="958" y="74" text-anchor="end" class="muted">•••</text>
  <line x1="30" y1="102" x2="1010" y2="102" stroke="#2d3947"/>

  <!-- Tomato brand -->
  <circle cx="94" cy="158" r="33" fill="#f04444"/>
  <ellipse cx="94" cy="166" rx="34" ry="26" fill="#ea4b4b"/>
  <path d="M93 124 L86 139 L70 132 L80 148 L64 151 L85 158 L94 143 L104 158 L125 151 L108 147 L118 132 L101 138 Z" fill="#45b94f"/>
  <text x="144" y="155" class="title">PomidorQA CI summary</text>
  <text x="144" y="187" class="subtitle">Автоматические проверки кода, тестов и окружения</text>

  <rect x="705" y="126" width="267" height="64" rx="14" fill="${overall.bg}" stroke="${overall.color}" stroke-opacity="0.55"/>
  <circle cx="738" cy="158" r="17" fill="${overall.color}"/>
  <text x="738" y="159" text-anchor="middle" class="checkIcon">${overall.icon}</text>
  <text x="770" y="153" fill="#d7f7df" font-size="18" font-weight="700">${escapeXml(overall.title)}</text>
  <text x="770" y="176" fill="#8b949e" font-size="14">${escapeXml(overall.subtitle)}</text>

  <line x1="66" y1="222" x2="972" y2="222" stroke="#2d3947"/>

  <!-- Checks -->
  <rect x="66" y="246" width="482" height="354" rx="14" fill="#0a111b" stroke="#30363d"/>
  <text x="90" y="286" class="section">Проверка</text>
  <text x="420" y="286" class="section">Результат</text>
  <line x1="66" y1="300" x2="548" y2="300" stroke="#30363d"/>
  ${rows}

  <!-- Environment -->
  <rect x="66" y="624" width="482" height="202" rx="14" fill="#0a111b" stroke="#30363d"/>
  <text x="90" y="661" class="section">⚙ Окружение</text>
  <text x="92" y="703" class="env">• Node.js: 24</text>
  <text x="92" y="736" class="env">• E2E workers: 1 (shared live stand)</text>
  <text x="92" y="769" class="env">• E2E retries: 2</text>
  <text x="92" y="802" class="env">• Кэш Playwright: ${escapeXml(cacheHit)}</text>

  <!-- Telegram integration feature -->
  <rect x="574" y="246" width="398" height="580" rx="14" fill="#0b1521" stroke="#2f4561"/>
  <circle cx="891" cy="316" r="35" fill="#2aabee"/>
  <path d="M870 316 L916 299 L900 340 L888 326 L879 335 L881 320 Z" fill="#ffffff" opacity="0.95"/>
  <path d="M602 310 C680 365 744 282 846 311" fill="none" stroke="#2aabee" stroke-width="3" stroke-dasharray="10 9" opacity="0.8"/>
  <text x="610" y="378" class="section">Результаты CI</text>
  <text x="610" y="407" class="section">в вашем Telegram</text>
  <text x="610" y="447" class="subtitle">Получайте статус сборки сразу</text>
  <text x="610" y="473" class="subtitle">после завершения pipeline.</text>

  <rect x="610" y="506" width="326" height="58" rx="12" fill="#111c29" stroke="#27384a"/>
  <text x="632" y="531" fill="#f0f6fc" font-size="17" font-weight="700">🔔 Мгновенные уведомления</text>
  <text x="632" y="552" class="muted" font-size="14">Сразу после завершения CI</text>

  <rect x="610" y="580" width="326" height="58" rx="12" fill="#111c29" stroke="#27384a"/>
  <text x="632" y="605" fill="#f0f6fc" font-size="17" font-weight="700">▤ Подробный результат</text>
  <text x="632" y="626" class="muted" font-size="14">Quality · Unit · API · E2E</text>

  <rect x="610" y="654" width="326" height="58" rx="12" fill="#111c29" stroke="#27384a"/>
  <text x="632" y="679" fill="#f0f6fc" font-size="17" font-weight="700">🔗 Прямая ссылка на run</text>
  <text x="632" y="700" class="muted" font-size="14">Логи и artifacts в один клик</text>

  <rect x="610" y="744" width="326" height="54" rx="12" fill="#123823" stroke="#238636"/>
  <circle cx="638" cy="771" r="14" fill="#3fb950"/>
  <text x="638" y="772" text-anchor="middle" class="checkIcon">✓</text>
  <text x="664" y="766" fill="#7ee787" font-size="16" font-weight="700">Telegram настроен</text>
  <text x="664" y="787" fill="#8b949e" font-size="13">@Tokhirjon_QA_Bot</text>

  <!-- Telegram phone/card -->
  <rect x="1040" y="28" width="530" height="844" rx="22" fill="#0b1522" stroke="#2d3947" filter="url(#shadow)"/>
  <circle cx="1103" cy="84" r="32" fill="#2aabee"/>
  <path d="M1082 84 L1125 68 L1110 107 L1099 94 L1090 102 L1092 88 Z" fill="#ffffff"/>
  <text x="1152" y="77" fill="#f0f6fc" font-size="24" font-weight="700">Telegram</text>
  <text x="1152" y="104" class="muted">Быстрые уведомления о CI</text>

  <rect x="1070" y="142" width="470" height="650" rx="20" fill="#152235" stroke="#33455c"/>
  <circle cx="1122" cy="196" r="29" fill="#ef4d4d"/>
  <path d="M1121 165 L1114 179 L1100 173 L1108 187 L1094 191 L1114 195 L1122 182 L1131 196 L1150 190 L1135 186 L1144 173 L1129 179 Z" fill="#45b94f"/>
  <text x="1165" y="188" fill="#f0f6fc" font-size="23" font-weight="700">🍅 PomidorQA CI</text>
  <text x="1165" y="216" class="tgMeta">Автоматические проверки проекта</text>
  <line x1="1100" y1="242" x2="1510" y2="242" stroke="#33455c"/>

  <text x="1100" y="286" fill="#f0f6fc" font-size="18" font-weight="700">Статус:</text>
  <rect x="1205" y="258" width="170" height="39" rx="10" fill="${overall.bg}" stroke="${overall.color}" stroke-opacity="0.6"/>
  <text x="1224" y="284" fill="${overall.color}" font-size="18" font-weight="800">${overall.icon} ${escapeXml(overall.title.toUpperCase())}</text>

  <text x="1100" y="337" class="tgMeta">Репозиторий:</text>
  <text x="1216" y="337" class="link">${escapeXml(repository)}</text>
  <text x="1100" y="371" class="tgMeta">Ветка:</text>
  <text x="1216" y="371" fill="#e6edf3" font-size="16">${escapeXml(branch)}</text>
  <text x="1100" y="405" class="tgMeta">Событие:</text>
  <text x="1216" y="405" fill="#e6edf3" font-size="16">${escapeXml(eventLabel)}</text>
  <text x="1100" y="439" class="tgMeta">Автор:</text>
  <text x="1216" y="439" fill="#e6edf3" font-size="16">${escapeXml(actor)}</text>

  <text x="1100" y="478" fill="#f0f6fc" font-size="18" font-weight="700">Проверки:</text>
  ${telegramRows}

  <line x1="1100" y1="676" x2="1510" y2="676" stroke="#33455c"/>
  <text x="1100" y="714" fill="#f0f6fc" font-size="18" font-weight="700">🔗 Открыть запуск</text>
  <text x="1100" y="745" class="link">Run #${escapeXml(runNumber)} · GitHub Actions</text>
  <text x="1100" y="772" class="muted" font-size="13">${escapeXml(runUrl)}</text>

  <text x="66" y="854" fill="#8b949e" font-size="14">PomidorQA · Качественный код сегодня — уверенный релиз завтра 🍅</text>
</svg>`;

const html = `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>PomidorQA CI Dashboard · Run #${escapeXml(runNumber)}</title>
  <style>
    :root { color-scheme: dark; }
    * { box-sizing: border-box; }
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #070b12; font-family: system-ui, sans-serif; }
    main { width: min(1600px, 100%); padding: 18px; }
    img { display: block; width: 100%; height: auto; border-radius: 18px; box-shadow: 0 20px 80px rgba(0,0,0,.45); }
    nav { display: flex; justify-content: center; gap: 12px; margin-top: 16px; }
    a { color: #58a6ff; text-decoration: none; padding: 10px 14px; border: 1px solid #30363d; border-radius: 10px; background: #0d1117; }
  </style>
</head>
<body>
  <main>
    <img src="dashboard.svg" alt="PomidorQA CI Dashboard" />
    <nav><a href="${escapeXml(runUrl)}">Открыть GitHub Actions run #${escapeXml(runNumber)}</a></nav>
  </main>
</body>
</html>`;

await mkdir(outDir, { recursive: true });
await Promise.all([
  writeFile(resolve(outDir, "dashboard.svg"), svg, "utf8"),
  writeFile(resolve(outDir, "index.html"), html, "utf8"),
]);

console.log(`PomidorQA dashboard generated in ${outDir}`);
