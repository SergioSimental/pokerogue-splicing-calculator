// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it, vi } from "vitest";

// Opening a shared link starts the page with that build. This is a separate file because the page loads its link
// once, when the script starts, and every other test file starts from the defaults.
const mon = (name: string, stats: number[], abilities: { regular: string[]; hidden: string | null }) => ({
  name, stats, types: ["Normal"], passive: "Passive", abilities, fusionName: name, canEvolve: false, isMax: false, isMega: false, isSpecial: false,
});
const dex = [
  mon("Charizard", [50, 50, 50, 50, 50, 50], { regular: ["Blaze"], hidden: "Solar Power" }),
  mon("Garchomp", [50, 50, 50, 50, 50, 50], { regular: ["Sand Veil"], hidden: "Rough Skin" }),
  mon("Ditto", [50, 50, 50, 50, 50, 50], { regular: ["Limber"], hidden: "Imposter" }),
  mon("Snorlax", [160, 110, 65, 65, 110, 30], { regular: ["Immunity", "Thick Fat"], hidden: "Gluttony" }),
];

const $ = (selector: string) => document.querySelector(selector);
const value = (id: string) => ($(`#${id}`) as HTMLInputElement).value;

const LINK = "p=Ditto&s=Snorlax&l=72&n=Adamant&iv=31,31,31,31,31,0&ab=Gluttony&pp=1&pi=sd2,v0-6,metal-powder&si=mb30&rb=spe&rt=Normal&ra=Limber&hf=mega,special";

beforeAll(async () => {
  const html = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), "../index.html"), "utf8");
  const body = /<body[^>]*>([\s\S]*)<\/body>/.exec(html)?.[1] ?? "";
  document.body.innerHTML = body.replace(/<script[\s\S]*?<\/script>/g, "");
  vi.stubGlobal("fetch", async () => ({ ok: true, json: async () => dex }));
  history.replaceState(null, "", `/?${LINK}`);
  await import("../src/main.js");
  await vi.waitFor(() => expect($("#result h2")).not.toBeNull());
});

describe("opening a shared link", () => {
  it("starts the page with the linked build", () => {
    expect(value("primary")).toBe("Ditto");
    expect(value("secondary")).toBe("Snorlax");
    expect(value("level")).toBe("72");
    expect(value("nature")).toContain("Adamant");
    expect(value("iv5")).toBe("0");
    expect((($("#ability") as HTMLSelectElement).selectedOptions[0])?.textContent).toBe("Gluttony (Hidden)");
    expect(($("#passive-unlocked") as HTMLInputElement).checked).toBe(true);
    expect(value("soul-dew")).toBe("2");
    expect(value("vitamin0")).toBe("6");
    expect(($("#item-metal-powder") as HTMLInputElement).checked).toBe(true);
    expect(value("secondary-macho-brace")).toBe("30");
  });

  it("starts the partner filters from the link", () => {
    expect(($("#rank-by") as HTMLSelectElement).value).toBe("5");
    expect(($("#rank-type") as HTMLSelectElement).value).toBe("Normal");
    expect(value("rank-ability")).toBe("Limber");
    // Only Ditto can give Limber, so it is the only partner listed.
    expect(Array.from(document.querySelectorAll("#partner-body .pickbtn")).map(b => b.textContent?.trim())).toEqual(["Ditto"]);
    expect(($("#rank-hidemax") as HTMLInputElement).checked).toBe(false);
    expect(($("#rank-hidemega") as HTMLInputElement).checked).toBe(true);
    expect(($("#rank-hidespecial") as HTMLInputElement).checked).toBe(true);
  });

  it("shows no warning, and the link stays the same", () => {
    expect(($("#share-note") as HTMLElement).hidden).toBe(true);
    expect(location.search).toBe(`?p=Ditto&s=Snorlax&l=72&n=Adamant&iv=31,31,31,31,31,0&ab=Gluttony&pp=1&pi=sd2,v0-6,metal-powder&si=mb30&rb=spe&rt=Normal&ra=Limber&hf=mega,special`);
  });

  it("works out the result for that build", () => {
    expect($("#result h2")?.textContent).toContain("Ditto");
    const hp = $("#result .stat:not(.labels) .lvl")?.textContent ?? "";
    expect(Number(hp.replace(/[^0-9]/g, ""))).toBeGreaterThan(100);
  });
});

describe("partner filters and the link", () => {
  const change = (id: string, set: (el: HTMLInputElement & HTMLSelectElement) => void) => {
    const el = $(`#${id}`) as HTMLInputElement & HTMLSelectElement;
    set(el);
    el.dispatchEvent(new Event("change", { bubbles: true }));
  };

  it("writes a changed filter into the link and keeps the rest of the build", () => {
    change("rank-by", el => { el.value = "1"; });
    change("rank-hidemax", el => { el.checked = true; });
    change("rank-type", el => { el.value = ""; });
    expect(location.search).toContain("&rb=atk");
    expect(location.search).toContain("&hf=max,mega,special");
    expect(location.search).not.toContain("rt=");
    expect(location.search).toContain("l=72");
  });

  it("clears the ability filter when a link does not name one", () => {
    expect(value("rank-ability")).toBe("Limber");
    history.replaceState(null, "", "/?p=Ditto&s=Snorlax");
    window.dispatchEvent(new PopStateEvent("popstate"));
    expect(value("rank-ability")).toBe("Any ability");
    expect(location.search).not.toContain("ra=");
  });

  it("puts filters a link leaves out back to their defaults, and says when a type is unknown", () => {
    history.replaceState(null, "", "/?p=Ditto&s=Snorlax&rt=Shadow&ra=Bogus");
    window.dispatchEvent(new PopStateEvent("popstate"));
    expect(($("#rank-by") as HTMLSelectElement).value).toBe("total");
    expect(($("#rank-type") as HTMLSelectElement).value).toBe("");
    for (const id of ["rank-hidemax", "rank-hidemega", "rank-hidespecial"]) expect(($(`#${id}`) as HTMLInputElement).checked, id).toBe(false);
    expect(($("#share-note") as HTMLElement).hidden).toBe(false);
    expect($("#share-note")?.textContent).toContain('type "Shadow"');
    expect($("#share-note")?.textContent).toContain('partner ability "Bogus"');
    expect(value("rank-ability")).toBe("Any ability");
    expect(location.search).not.toMatch(/rb=|rt=|ra=|hf=/);
  });
});
