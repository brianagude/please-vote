// How to reach each officeholder: office phone, address, email or contact form, website, and official social accounts.
//   Congress: unitedstates/congress-legislators (legislators-current, legislators-social-media), no key
//   State legislators: Open States /people (offices, email)
import path from "node:path";
import { candidates, getJSON, log, readJSON, stateDir, writeJSON } from "./lib.ts";

const BASE = "https://unitedstates.github.io/congress-legislators";

export interface Contact {
  phone?: string;
  address?: string;
  email?: string;
  form?: string;
  website?: string;
  social: { label: string; url: string }[];
  source: { label: string; url: string };
}

const SOCIAL: Record<string, (h: string) => { label: string; url: string }> = {
  twitter: (h) => ({ label: "X (Twitter)", url: `https://x.com/${h}` }),
  facebook: (h) => ({ label: "Facebook", url: `https://www.facebook.com/${h}` }),
  instagram: (h) => ({ label: "Instagram", url: `https://www.instagram.com/${h}` }),
  youtube: (h) => ({ label: "YouTube", url: `https://www.youtube.com/${h}` }),
  youtube_id: (h) => ({ label: "YouTube", url: `https://www.youtube.com/channel/${h}` }),
};

export async function contact(code: string) {
  const sd = stateDir(code);
  const all = candidates(readJSON(path.join(sd, "races.json"))).map(({ c }) => c);
  const out: Record<string, Contact> = {};

  const fed = all.filter((c) => c.ids?.bioguide);
  if (fed.length) {
    const [people, social] = await Promise.all([getJSON<any[]>(`${BASE}/legislators-current.json`), getJSON<any[]>(`${BASE}/legislators-social-media.json`)]);
    for (const c of fed) {
      const p = people.find((x) => x.id.bioguide === c.ids.bioguide);
      if (!p) continue;
      const t = p.terms.at(-1);
      const s = social.find((x) => x.id.bioguide === c.ids.bioguide)?.social ?? {};
      const links = Object.entries(s)
        .filter(([k]) => SOCIAL[k] && !(k === "youtube_id" && s.youtube))
        .map(([k, h]) => SOCIAL[k](String(h)));
      out[c.id] = {
        phone: t.phone,
        address: t.address,
        form: t.contact_form,
        website: t.url,
        social: links,
        source: { label: "unitedstates/congress-legislators", url: "https://github.com/unitedstates/congress-legislators" },
      };
    }
  }

  const st = all.filter((c) => c.ids?.openstates);
  if (st.length) {
    const key = process.env.OPENSTATES_API_KEY;
    if (!key) throw new Error("OPENSTATES_API_KEY is not set");
    const u = new URL("https://v3.openstates.org/people");
    for (const c of st) u.searchParams.append("id", c.ids.openstates);
    u.searchParams.append("include", "offices");
    u.searchParams.set("per_page", "50");
    const res = (await getJSON(u, { headers: { "X-API-KEY": key } })).results ?? [];
    for (const c of st) {
      const p = res.find((x: any) => x.id === c.ids.openstates);
      if (!p) continue;
      // The Capitol office is where the phone is answered during the session.
      const office = p.offices?.find((o: any) => o.classification === "capitol" && (o.voice || o.address)) ?? p.offices?.find((o: any) => o.voice || o.address);
      out[c.id] = {
        phone: office?.voice || undefined,
        address: office?.address || undefined,
        email: p.email || undefined,
        social: [],
        source: { label: "Open States", url: p.openstates_url },
      };
    }
  }

  const changed = writeJSON(path.join(sd, "generated/contact.json"), out);
  log("contact", `${Object.keys(out).length} people${changed ? " (updated)" : ""}`);
}
