// Everything the page does in the browser: countdown, date status,
// address and ZIP lookup, and showing the voter's own district races.

const $ = <T extends Element = HTMLElement>(s: string, root: ParentNode = document) => root.querySelector<T>(s)!;
const $$ = <T extends Element = HTMLElement>(s: string, root: ParentNode = document) => [...root.querySelectorAll<T>(s)];

// Which state this page is for, from the page itself (StateGuide's wrapper).
const page = document.querySelector<HTMLElement>("[data-state]")!.dataset;
const STATE = page.state!; // "GA"
const STATE_NAME = page.stateName!; // "Georgia"
// Dates are judged in the state's own time zone, whatever the reader's clock says.
const TZ = page.tz || "America/New_York";
const todayISO = () => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
const dayNum = (iso: string) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / 864e5;

function countdown() {
  const el = $("#count");
  const days = dayNum(el.dataset.election!) - dayNum(todayISO());
  const [n, l] = [$("#count-n"), $("#count-l")];
  if (days > 1) n.textContent = String(days);
  else if (days === 1) [n.textContent, l.textContent] = ["1", "Day to go"];
  else if (days === 0) [n.textContent, l.textContent] = ["Today", "It's election day"];
  else [n.textContent, l.textContent] = ["Done", "Thanks for voting"];
}

function dateCards() {
  const today = dayNum(todayISO());
  for (const d of $$("#dates .d")) {
    const s = dayNum(d.dataset.start!);
    const e = d.dataset.end ? dayNum(d.dataset.end) : s;
    let k: string, t: string;
    if (e < today) [k, t] = ["passed", "Passed"];
    else if (s <= today) [k, t] = ["open", d.dataset.end ? "● Open now" : "● Today"];
    else if (s - today <= 10) [k, t] = ["soon", "Coming up"];
    else [k, t] = ["later", "Upcoming"];
    d.classList.add(`is-${k}`);
    const st = $(".st", d);
    st.classList.add(k);
    st.textContent = t.replace("● ", "");
    if (t.startsWith("●")) st.insertAdjacentHTML("afterbegin", '<span class="dot" aria-hidden="true">●</span> ');
    if (k === "passed") d.querySelector(".sub")?.remove();
  }
}

// ---- districts ----
type Picks = { house: string; upper: string; lower: string; zip: string; via?: "address" | "zip" };
const KEY = `please-vote:${STATE.toLowerCase()}`;
const picks: Picks = { house: "", upper: "", lower: "", zip: "" };
try {
  Object.assign(picks, JSON.parse(localStorage.getItem(KEY) || "{}"));
} catch {}
const save = () => {
  try {
    localStorage.setItem(KEY, JSON.stringify(picks));
  } catch {}
};

function show() {
  // U.S. House
  const houses = $$<HTMLElement>("[data-house]");
  const hasHouse = houses.some((a) => a.dataset.house === picks.house && picks.house);
  for (const a of houses) a.hidden = hasHouse ? a.dataset.house !== picks.house : a.dataset.house !== "";
  const inside = $("[data-inside=house]");
  inside.textContent = hasHouse ? `U.S. House (Dist. ${picks.house})` : "U.S. House";

  // State Senate / State House: one card each, one seat cell shown
  for (const card of $$("[data-chamber]")) {
    const ch = card.dataset.chamber as "upper" | "lower";
    const n = picks[ch];
    const cells = $$("[data-seat]", card);
    const match = n && cells.some((c) => c.dataset.seat === n);
    for (const c of cells) c.hidden = c.dataset.seat !== (n ? (match ? n : "unknown") : "");
    $("[data-title]", card).textContent = n ? `${card.dataset.label} · District ${n}` : card.dataset.label!;
  }
  $<HTMLSelectElement>("#sel-upper").value = picks.upper;
  $<HTMLSelectElement>("#sel-lower").value = picks.lower;
}

const ZIP: Record<string, number[]> = JSON.parse($("#zip-data").textContent || "{}");

function zipUpdate(fromUser: boolean) {
  const zi = $<HTMLInputElement>("#zip");
  const z = zi.value.trim();
  const hint = $("#zip-hint");
  const ch = $("#zip-choices");
  ch.innerHTML = "";
  if (z.length < 5) {
    hint.textContent = "Sets your U.S. House race.";
    if (fromUser && picks.house) Object.assign(picks, { house: "", zip: "" });
    return finish();
  }
  if (!/^\d{5}$/.test(z)) return void (hint.textContent = "Use 5 digits.");
  const ds = ZIP[z];
  picks.zip = z;
  picks.via = "zip";
  if (!ds) {
    hint.textContent = `Not a ${STATE_NAME} ZIP we know.`;
    picks.house = "";
    return finish();
  }
  if (ds.length === 1) {
    picks.house = String(ds[0]);
    hint.innerHTML = `You're in <b>District ${ds[0]}</b>.`;
  } else {
    if (!ds.map(String).includes(picks.house)) picks.house = "";
    hint.textContent = "This ZIP is split. Which one?";
    for (const d of ds) {
      const b = document.createElement("button");
      Object.assign(b, { type: "button", className: "btn ghost", textContent: `Dist. ${d}` });
      b.setAttribute("aria-pressed", String(picks.house === String(d)));
      b.onclick = () => {
        picks.house = String(d);
        $$("button", ch).forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
        finish();
      };
      ch.append(b);
    }
  }
  finish();
}

function finish() {
  save();
  show();
}

async function lookup(e: SubmitEvent) {
  e.preventDefault();
  const input = $<HTMLInputElement>("#addr");
  const hint = $("#addr-hint");
  const address = input.value.trim();
  if (address.length < 6) return void (hint.textContent = "Type your street address, city, and ZIP.");
  hint.textContent = "Looking it up…";
  try {
    const res = await fetch("/api/district", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ address }),
    });
    const r = await res.json();
    if (!res.ok) throw new Error(r.error || "lookup failed");
    if (!r.match) return void (hint.textContent = "We couldn't find that address. Check it, or use your ZIP code below.");
    if (r.state !== STATE) return void (hint.textContent = `That address isn't in ${STATE_NAME}.`);
    Object.assign(picks, { house: r.house ?? "", upper: r.upper ?? "", lower: r.lower ?? "", via: "address" });
    const zip = /\b(\d{5})(?:-\d{4})?\s*$/.exec(r.matched || "")?.[1];
    if (zip) $<HTMLInputElement>("#zip").value = picks.zip = zip;
    $("#zip-choices").innerHTML = "";
    $("#zip-hint").innerHTML = picks.house ? `You're in <b>District ${picks.house}</b>.` : "";
    hint.innerHTML = `Found it. Your ballot below is updated.`;
    finish();
  } catch {
    hint.textContent = "The lookup isn't working right now. Use your ZIP code below.";
  }
}

function motionToggle() {
  const btn = document.getElementById("motion");
  if (!btn) return;
  const root = document.documentElement;
  const sync = () => {
    const still = root.classList.contains("still");
    btn.textContent = still ? "Play motion" : "Pause motion";
    btn.setAttribute("aria-pressed", String(still));
  };
  btn.addEventListener("click", () => {
    root.classList.toggle("still");
    try {
      localStorage.setItem("please-vote:still", root.classList.contains("still") ? "1" : "0");
    } catch {}
    sync();
  });
  sync();
}

/** Load all three drawings of the background people before animating them,
 *  so they never disappear for a moment while a frame downloads. */
async function startBoil() {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const sides = matchMedia("(min-width: 1120px)").matches ? ["left", "right"] : ["top", "bottom"];
  // Each state's guide has its own drawings (some signs show the state's name).
  const dir = document.querySelector<HTMLElement>("[data-people]")?.dataset.people ?? "/people/";
  const frames = sides.flatMap((s) => [0, 1, 2].map((n) => `${dir}${s}-${n}.svg`));
  try {
    await Promise.all(
      frames.map((src) => {
        const img = new Image();
        img.src = src;
        return img.decode();
      }),
    );
    document.documentElement.classList.add("boil");
  } catch {
    // If a drawing fails to load, the people just stay still.
  }
}

/** The State box in the masthead: picking a state goes to its guide. */
function statePicker() {
  const sel = document.querySelector<HTMLSelectElement>("#state-pick");
  sel?.addEventListener("change", () => (location.href = sel.value));
}

export function start() {
  // Remember which state's guide this is, so "Back to the guide" links elsewhere come back here.
  try {
    localStorage.setItem("please-vote:guide", JSON.stringify({ path: location.pathname, name: STATE_NAME }));
  } catch {}
  statePicker();
  motionToggle();
  startBoil();
  countdown();
  dateCards();
  const zi = $<HTMLInputElement>("#zip");
  zi.value = picks.zip;
  zi.addEventListener("input", () => zipUpdate(true));
  for (const ch of ["upper", "lower"] as const) {
    $<HTMLSelectElement>(`#sel-${ch}`).addEventListener("change", (e) => {
      picks[ch] = (e.target as HTMLSelectElement).value;
      finish();
    });
  }
  $<HTMLFormElement>("#addr-form").addEventListener("submit", lookup);
  // Districts from a full address beat the ZIP guess, so don't redo the ZIP step.
  if (picks.via === "address" && picks.house) $("#zip-hint").innerHTML = `You're in <b>District ${picks.house}</b>.`;
  else if (picks.zip) zipUpdate(false);
  show();
}
