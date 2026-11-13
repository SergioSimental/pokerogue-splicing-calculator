// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it, vi } from "vitest";

// Opening a shared link starts the page with that build. This is a separate file because the page loads its link
// once, when the script starts, and every other test file starts from the defaults.
const mon = (name: string, stats: number[], abilities: { regular: string[]; hidden: string | null }) => ({
  name, stats, types: ["Normal"], passive: "Passive", abilities, fusionName: name, canEvolve: false, isMax: false,
});
const dex = [
  mon("Charizard", [50, 50, 50, 50, 50, 50], { regular: ["Blaze"], hidden: "Solar Power" }),
  mon("Garchomp", [50, 50, 50, 50, 50, 50], { regular: ["Sand Veil"], hidden: "Rough Skin" }),
  mon("Ditto", [50, 50, 50, 50, 50, 50], { regular: ["Limber"], hidden: "Imposter" }),
  mon("Snorlax", [160, 110, 65, 65, 110, 30], { regular: ["Immunity", "Thick Fat"], hidden: "Gluttony" }),
];

const $ = (selector: string) => document.querySelector(selector);
const value = (id: string) => ($(`#${id}`) as HTMLInputElement).value;

const LINK = "p=Ditto&s=Snorlax&l=72&n=Adamant&iv=31,31,31,31,31,0&ab=Gluttony&pp=1&pi=sd2,v0-6,metal-powder&si=mb30";

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

  it("shows no warning, and the link stays the same", () => {
    expect(($("#share-note") as HTMLElement).hidden).toBe(true);
    expect(location.search).toBe(`?p=Ditto&s=Snorlax&l=72&n=Adamant&iv=31,31,31,31,31,0&ab=Gluttony&pp=1&pi=sd2,v0-6,metal-powder&si=mb30`);
  });

  it("works out the result for that build", () => {
    expect($("#result h2")?.textContent).toContain("Ditto");
    const hp = $("#result .stat:not(.labels) .lvl")?.textContent ?? "";
    expect(Number(hp.replace(/[^0-9]/g, ""))).toBeGreaterThan(100);
  });
});
