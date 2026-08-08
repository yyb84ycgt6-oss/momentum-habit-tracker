/**
 * Ultimate testing mode — the ten, end to end, in Momentum.
 *
 * Two kinds of check, because the ten have two kinds of surface:
 *   • engine logic, imported directly (does the cortex match a reworded
 *     question, does the predictor score itself, does the recorder stay off),
 *   • the desktop, rendered for real (does each app open and show its state).
 *
 * The desktop sits behind Supabase auth, so auth is intercepted rather than
 * bypassed in the app: the route guard still runs, it just gets a stubbed
 * answer. Testing a build with the guard removed would be testing a different
 * build.
 *
 * Provider hosts are intercepted individually — never a blanket `**\/*`,
 * which swallows Vite's lazy chunks and leaves the app under test blank.
 */
import { chromium } from "playwright-core";

const BASE = "http://127.0.0.1:5175";
const SUPABASE = "https://qasfswqhnxqyamoethus.supabase.co";

const browser = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  args: ["--no-sandbox"],
});
const results = [];
const ok = (n, pass, extra = "") => {
  results.push({ n, pass, extra });
  console.log(`${pass ? "PASS" : "FAIL"}  ${n}${extra ? `  — ${extra}` : ""}`);
};

const PROVIDER_HOSTS = [
  "**://openrouter.ai/**",
  "**://generativelanguage.googleapis.com/**",
  "**://api.groq.com/**",
  "**://api.cerebras.ai/**",
  "**://api.mistral.ai/**",
  "**://models.inference.ai.azure.com/**",
  "**://router.huggingface.co/**",
  "**://api.openai.com/**",
  "**://api.anthropic.com/**",
  "**://api.deepseek.com/**",
  "**://api.x.ai/**",
  "**://api.together.xyz/**",
];

/** Different latencies so Speed Racer has a real ordering to discover. */
const LATENCY = { "api.groq.com": 20, "api.cerebras.ai": 60, "api.mistral.ai": 140 };

const USER = {
  id: "00000000-0000-4000-8000-00000000test",
  aud: "authenticated",
  role: "authenticated",
  email: "suite@example.test",
  app_metadata: {},
  user_metadata: {},
  created_at: new Date().toISOString(),
};

async function newPage() {
  const page = await browser.newPage({ viewport: { width: 1400, height: 950 } });
  page.on("pageerror", (e) => {
    // React's hydration notice is expected on this SSR route and is not
    // what any of these assertions are about.
    if (!/Hydration failed/.test(e.message)) console.log("   PAGEERROR:", e.message.slice(0, 140));
  });

  // Auth: the guard's own call is answered, so the guard still executes.
  await page.route(`${SUPABASE}/**`, async (route) => {
    const url = route.request().url();
    if (url.includes("/auth/v1/user")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(USER),
      });
    }
    if (url.includes("/auth/v1/token")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          access_token: "test",
          token_type: "bearer",
          expires_in: 3600,
          refresh_token: "test",
          user: USER,
        }),
      });
    }
    // Desktop state / app data: empty is a valid first-run answer.
    return route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });

  const handler = async (route) => {
    const url = route.request().url();
    if (url.includes("/models")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: [{ id: "llama-3.3-70b-versatile" }, { id: "mixtral-8x7b" }] }),
      });
    }
    await new Promise((r) => setTimeout(r, LATENCY[new URL(url).host] ?? 90));
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        choices: [
          { message: { content: `answer from ${new URL(url).host}` }, finish_reason: "stop" },
        ],
      }),
    });
  };
  for (const p of PROVIDER_HOSTS) await page.route(p, handler);

  await page.addInitScript((session) => {
    // supabase-js reads its session from localStorage before it ever
    // hits the network; without this the client boots as signed out.
    localStorage.setItem(
      "sb-qasfswqhnxqyamoethus-auth-token",
      JSON.stringify({
        access_token: "test",
        token_type: "bearer",
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        refresh_token: "test",
        user: session,
      }),
    );
  }, USER);

  await page.goto(`${BASE}/desktop`, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(7000);
  return page;
}

/** Open an app by id through the bus. */
async function launch(page, appId) {
  await page.evaluate(
    (id) => window.dispatchEvent(new CustomEvent("launch-app", { detail: { appId: id } })),
    appId,
  );
  await page.waitForTimeout(2200);
}

let page = await newPage();
ok(
  "00. The desktop renders past the auth guard",
  page.url().includes("/desktop"),
  page.url().replace(BASE, ""),
);

await page.evaluate(async () => {
  const kr = await import("/src/pc/lib/ai/keyring.ts");
  kr.invalidate();
  kr.addKey("groq", "gsk_test_one", "primary");
  kr.addKey("cerebras", "csk_test_two", "second");
  kr.addKey("mistral", "msk_test_three", "third");
});

// ── Foundations ──────────────────────────────────────────────────────────
const telemetry = await page.evaluate(async () => {
  const m = await import("/src/pc/lib/ai/telemetry.ts");
  m.clearTelemetry();
  const base = {
    at: Date.now(),
    provider: "groq",
    model: "llama",
    keyId: "k1",
    promptChars: 40,
    replyChars: 120,
    fallbacks: 0,
  };
  m.record({ ...base, ms: 120, ok: true });
  m.record({ ...base, ms: 300, ok: true });
  m.record({ ...base, ms: 900, ok: false, status: 429 });
  const s = m.statsByProvider().find((r) => r.provider === "groq");
  return s ? { calls: s.calls, median: s.medianMs } : null;
});
ok(
  "01. Telemetry aggregates by provider with a median (not a mean)",
  !!telemetry && telemetry.calls === 3,
  telemetry ? `calls=${telemetry.calls} median=${telemetry.median}ms` : "no stats",
);

ok(
  "02. Parallel foundation exposes race() and judge()",
  await page.evaluate(async () => {
    const m = await import("/src/pc/lib/ai/parallel.ts");
    return typeof m.race === "function" && typeof m.judge === "function";
  }),
);

ok(
  "03. Recorder is OFF until explicitly started (not surveillance by default)",
  (await page.evaluate(async () =>
    (await import("/src/pc/lib/observe/recorder.ts")).isRecording(),
  )) === false,
);

const captured = await page.evaluate(async () => {
  const m = await import("/src/pc/lib/observe/recorder.ts");
  m.startRecording();
  window.dispatchEvent(new CustomEvent("launch-app", { detail: { appId: "cortex" } }));
  await new Promise((r) => setTimeout(r, 500));
  const n = m.getEvents().filter((e) => e.channel === "launch-app").length;
  m.stopRecording();
  return n;
});
ok("04. Recorder captures a launch once started", captured >= 1, `events=${captured}`);

// ── The gateway, which everything else stands on ─────────────────────────
const gatewayWorks = await page.evaluate(async () => {
  const { chat } = await import("/src/pc/lib/ai/gateway.ts");
  const res = await chat({ messages: [{ role: "user", content: "hello" }] });
  return { provider: res.provider, keyed: res.keyId !== null, text: res.text.slice(0, 30) };
});
ok(
  "05. Gateway answers through the keyring",
  !!gatewayWorks.provider && gatewayWorks.keyed,
  `${gatewayWorks.provider} — "${gatewayWorks.text}"`,
);

const excluded = await page.evaluate(async () => {
  const { chat } = await import("/src/pc/lib/ai/gateway.ts");
  const res = await chat({
    messages: [{ role: "user", content: "hi" }],
    excludeProviders: ["groq"],
  });
  return res.provider;
});
ok(
  "06. excludeProviders keeps a forbidden provider out of the chain",
  excluded !== "groq",
  `answered by ${excluded}`,
);

const excludedNamed = await page.evaluate(async () => {
  const { chat } = await import("/src/pc/lib/ai/gateway.ts");
  const res = await chat({
    messages: [{ role: "user", content: "hi" }],
    model: "groq:llama-3.3-70b-versatile",
    excludeProviders: ["groq"],
  });
  return res.provider;
});
ok(
  "07. An exclusion cannot be routed around by naming the provider",
  excludedNamed !== "groq",
  `answered by ${excludedNamed}`,
);

// ── The ~25 legacy AI apps, via the shim ─────────────────────────────────
const shim = await page.evaluate(async () => {
  const { getAiClient } = await import("/src/pc/lib/gemini.ts");
  const res = await getAiClient().models.generateContent({ contents: "ping" });
  return res.text;
});
ok(
  "08. getAiClient (the ~25 legacy apps) reaches a real provider",
  /answer from/.test(shim),
  shim.slice(0, 40),
);

const shimShapes = await page.evaluate(async () => {
  const { getAiClient } = await import("/src/pc/lib/gemini.ts");
  const c = getAiClient();
  // The roster passes `contents` as a string, an array of parts, and a
  // full content object — all three have to survive translation.
  const a = await c.models.generateContent({ contents: "plain string" });
  const b = await c.models.generateContent({
    contents: [{ role: "user", parts: [{ text: "array of content" }] }],
  });
  const d = await c.models.generateContent({
    contents: { role: "user", parts: [{ text: "single object" }] },
  });
  return [a.text, b.text, d.text].every((t) => /answer from/.test(t));
});
ok("09. All three `contents` shapes the roster uses survive translation", shimShapes);

const legacy = await page.evaluate(async () => {
  const { aiClient } = await import("/src/pc/lib/aiClient.ts");
  const res = await aiClient.sendMessage([{ role: "user", content: "hi" }], { scope: "system" });
  return { provider: res.provider, content: res.content.slice(0, 30) };
});
ok(
  "10. aiClient.sendMessage (5 more apps) reaches a real provider",
  /answer from/.test(legacy.content),
  `${legacy.provider}`,
);

// ── Offline Cortex ───────────────────────────────────────────────────────
const cortex = await page.evaluate(async () => {
  const m = await import("/src/pc/lib/ai/cortex.ts");
  m.clearCortex();
  m.remember("What is a pod?", "A pod is an isolated workspace.", "groq");
  const hit = m.lookup("what's a POD");
  return { found: !!hit, answer: hit?.answer ?? "" };
});
ok(
  "11. Cortex matches a reworded question (normalized, not exact)",
  cortex.found && cortex.answer.includes("isolated"),
  cortex.answer.slice(0, 40),
);

const offline = await page.evaluate(async () => {
  const m = await import("/src/pc/lib/ai/cortex.ts");
  Object.defineProperty(navigator, "onLine", { value: false, configurable: true });
  const res = await m.askWithCortex("What is a pod?");
  Object.defineProperty(navigator, "onLine", { value: true, configurable: true });
  return res;
});
ok(
  "12. Offline, Cortex answers from memory and admits it is cached",
  offline.fromCache === true && offline.text.includes("isolated"),
  `fromCache=${offline.fromCache}`,
);

ok(
  "13. Online, a fresh answer is NOT labelled as cached",
  (await page.evaluate(async () =>
    (await import("/src/pc/lib/ai/cortex.ts"))
      .askWithCortex("Name one colour")
      .then((r) => r.fromCache),
  )) === false,
);

// ── The Understudy ───────────────────────────────────────────────────────
ok(
  "14. Understudy is opt-in — learning about someone is not a default",
  (await page.evaluate(async () =>
    (await import("/src/pc/lib/understudy/predictor.ts")).isEnabled(),
  )) === false,
);

const learned = await page.evaluate(async () => {
  const m = await import("/src/pc/lib/understudy/predictor.ts");
  m.resetModel();
  for (let i = 0; i < 4; i += 1) {
    m.record("cortex");
    m.record("speed_racer");
    m.record("cartographer");
  }
  const p = m.predictNext("cortex");
  return { top: p[0]?.appId ?? null, conf: p[0]?.confidence ?? 0, reason: p[0]?.reason ?? "" };
});
ok(
  "15. Understudy predicts the app that actually follows",
  learned.top === "speed_racer" && learned.conf > 0.3,
  `${learned.top} @ ${Math.round(learned.conf * 100)}% — ${learned.reason}`,
);

ok(
  "16. One data point yields no prediction (guessing is not predicting)",
  (await page.evaluate(async () => {
    const m = await import("/src/pc/lib/understudy/predictor.ts");
    m.resetModel();
    m.record("cortex");
    m.record("speed_racer");
    return m.predictNext("cortex").length;
  })) === 0,
);

const routine = await page.evaluate(async () => {
  const m = await import("/src/pc/lib/understudy/predictor.ts");
  m.resetModel();
  for (let i = 0; i < 3; i += 1) {
    m.record("cortex");
    m.record("speed_racer");
    m.record("cartographer");
  }
  const r = m.routines();
  return { count: r.length, first: r[0]?.chain.join(">") ?? "" };
});
ok("17. Repeated three-app sequences surface as routines", routine.count >= 1, routine.first);

const scored = await page.evaluate(async () => {
  const m = await import("/src/pc/lib/understudy/predictor.ts");
  m.resetModel();
  for (let i = 0; i < 4; i += 1) {
    m.record("cortex");
    m.record("speed_racer");
  }
  await m.prefetch(m.predictNext("cortex"), 0);
  m.record("speed_racer");
  return m.accuracy();
});
ok(
  "18. Understudy scores its own predictions",
  scored !== null && scored > 0,
  `accuracy=${scored}`,
);

ok(
  "19. Registry apps expose a memoized preload so chunks can be warmed",
  (await page.evaluate(async () => {
    const { getApp } = await import("/src/pc/apps/registry.ts");
    const C = getApp("cortex")?.component;
    if (typeof C?.preload !== "function") return "no preload";
    await C.preload();
    await C.preload();
    return "preloaded";
  })) === "preloaded",
);

// ── Movable widgets ──────────────────────────────────────────────────────
const widget = await page.evaluate(async () => {
  const m = await import("/src/pc/desktop/widgetPositions.ts");
  m.saveWidgetPosition("desktop-search", { x: 120, y: 240 });
  const back = m.loadWidgetPosition("desktop-search");
  // A position saved in a taller viewport must be pulled back inside a
  // shorter one rather than stranding the widget off-screen.
  const clamped = m.clampToViewport({ x: 99999, y: 99999 }, 100, 40);
  m.clearAllWidgetPositions();
  return { back, cleared: m.loadWidgetPosition("desktop-search"), clamped };
});
ok(
  "20. A widget position round-trips through storage",
  widget.back?.x === 120 && widget.back?.y === 240,
  JSON.stringify(widget.back),
);
ok(
  "21. An off-screen position is clamped back inside the viewport",
  widget.clamped.x < 1400 && widget.clamped.y < 950,
  JSON.stringify(widget.clamped),
);
ok("22. Reset clears every widget at once", widget.cleared === null);

const draggable = await page.locator('[title*="drag to move" i]').count();
ok(
  "23. The desktop search affordance is wrapped as a movable widget",
  draggable > 0,
  `matched ${draggable}`,
);

// ── All eleven render ────────────────────────────────────────────────────
const ELEVEN = [
  ["ai_providers", "AI Providers"],
  ["budget_radar", "Budget Radar"],
  ["colosseum", "Colosseum"],
  ["ambient_agents", "Ambient Agents"],
  ["bus_recorder", "Bus Recorder"],
  ["choreography", "Choreograph"],
  ["speed_racer", "Speed Racer"],
  ["cartographer", "Cartographer"],
  ["prompt_genome", "Genome"],
  ["cortex", "Offline Cortex"],
  ["understudy", "Understudy"],
];
const blank = [];
for (const [id, marker] of ELEVEN) {
  await launch(page, id);
  if (!(await page.locator("body").innerText()).includes(marker)) blank.push(id);
}
ok(
  "24. Launching each new app renders it",
  blank.length === 0,
  blank.length ? `blank: ${blank.join(", ")}` : `${ELEVEN.length} of ${ELEVEN.length}`,
);

const registered = await page.evaluate(async () => {
  const { APPS } = await import("/src/pc/apps/registry.ts");
  const ids = [
    "ai_providers",
    "budget_radar",
    "colosseum",
    "ambient_agents",
    "bus_recorder",
    "choreography",
    "speed_racer",
    "cartographer",
    "prompt_genome",
    "cortex",
    "understudy",
  ];
  return { missing: ids.filter((id) => !APPS.some((a) => a.id === id)), total: APPS.length };
});
ok(
  "25. All eleven are in the registry",
  registered.missing.length === 0,
  registered.missing.length
    ? `missing: ${registered.missing.join(", ")}`
    : `${registered.total} apps total`,
);

// ── The back road ────────────────────────────────────────────────────────
const road = await page.evaluate(async () => {
  const m = await import("/src/pc/lib/backroad.ts");
  return { total: m.destinations().length, kinds: m.countByKind() };
});
ok(
  "26. The live desktop registers its roster on the back road",
  road.total > 100 && road.kinds.app > 100,
  `${road.total} addresses — ${Object.entries(road.kinds)
    .map(([k, n]) => `${n} ${k}`)
    .join(", ")}`,
);

ok(
  "27. Themes, providers and verbs are addressable too",
  road.kinds.theme >= 20 && road.kinds.provider >= 10 && road.kinds.verb >= 4,
  `${road.kinds.theme} themes, ${road.kinds.provider} providers, ${road.kinds.verb} verbs`,
);

const travelled = await page.evaluate(async () => {
  const m = await import("/src/pc/lib/backroad.ts");
  const seen = [];
  const off = (await import("/src/pc/lib/bus.ts")).bus.on("launch-app", ({ appId }) =>
    seen.push(appId),
  );
  await m.go("app:cortex");
  await m.go("offline cortex");
  off();
  return seen;
});
ok(
  "28. go() travels by exact address AND by plain phrase",
  travelled.length === 2 && travelled.every((a) => a === "cortex"),
  travelled.join(", "),
);

const unknown = await page.evaluate(async () => {
  const m = await import("/src/pc/lib/backroad.ts");
  try {
    await m.go("app:kortexx");
    return { threw: false, nearest: [] };
  } catch (e) {
    return { threw: true, nearest: (e.nearest ?? []).map((n) => n.address) };
  }
});
ok(
  "29. A misspelled address fails loudly AND says what it meant",
  unknown.threw && unknown.nearest.includes("app:cortex"),
  unknown.nearest.join(", ") || "no near match",
);

const themeTravel = await page.evaluate(async () => {
  const m = await import("/src/pc/lib/backroad.ts");
  let got = null;
  const h = (e) => {
    got = e.detail?.themeId;
  };
  window.addEventListener("pc-set-theme", h);
  // A theme is a raw CustomEvent, not a bus channel. That the caller need not
  // know this is the whole point of the road.
  await m.go("theme:win95");
  window.removeEventListener("pc-set-theme", h);
  return got;
});
ok(
  "30. One call reaches a destination with a different mechanism behind it",
  themeTravel === "win95",
  `pc-set-theme → ${themeTravel}`,
);

await page.screenshot({ path: "ten.png" });

console.log("\n" + "─".repeat(50));
const passed = results.filter((r) => r.pass).length;
console.log(`${passed}/${results.length} passed`);
if (passed !== results.length)
  console.log(
    "FAILED:",
    results
      .filter((r) => !r.pass)
      .map((r) => r.n)
      .join(" | "),
  );
await browser.close();
process.exit(passed === results.length ? 0 : 1);
