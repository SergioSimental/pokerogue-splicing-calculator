// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it, vi } from "vitest";

// A name full of characters that would break or inject markup if it were ever treated as HTML.
const HOSTILE = `<img src=x onerror="alert(1)"> & <script>alert(2)</script> "quoted" 'single'`;

const HOSTILE_PASSIVE = `Passive <b>A</b> & <img src=x>`;
const HOSTILE_ABILITY = `Ability <i>A</i> & <img src=x>`;

const dex = [
  { name: HOSTILE, stats: [100, 90, 80, 70, 60, 50], types: ["Fire", "Flying"], passive: HOSTILE_PASSIVE, abilities: { regular: [HOSTILE_ABILITY], hidden: null } },
  { name: "Safe Mon", stats: [50, 50, 50, 50, 50, 50], types: ["Water"], passive: "Passive B", abilities: { regular: ["Ability B", "Ability C"], hidden: "Hidden B" } },
];

const $ = (selector: string) => document.querySelector(selector);

beforeAll(async () => {
  // Load the real page structure (without its script tag), serve a fake dex, then start the app.
  const html = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), "../index.html"), "utf8");
  const body = /<body[^>]*>([\s\S]*)<\/body>/.exec(html)?.[1] ?? "";
  document.body.innerHTML = body.replace(/<script[\s\S]*?<\/script>/g, "");
  vi.stubGlobal("fetch", async () => ({ ok: true, json: async () => dex }));

  await import("../src/main.js");
  await vi.waitFor(() => expect($("#result h2")).not.toBeNull());

  // Pick the hostile entry as the primary Pokémon by typing part of its name.
  const primary = $("#primary") as HTMLInputElement;
  primary.dispatchEvent(new Event("focus"));
  primary.value = "img";
  primary.dispatchEvent(new Event("input", { bubbles: true }));
  primary.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));

  // And the other entry as the secondary Pokémon.
  const secondary = $("#secondary") as HTMLInputElement;
  secondary.dispatchEvent(new Event("focus"));
  secondary.value = "safe";
  secondary.dispatchEvent(new Event("input", { bubbles: true }));
  secondary.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
});

describe("results card renders names as plain text", () => {
  it("shows the exact name in the heading", () => {
    expect($("#result h2")?.textContent).toContain(HOSTILE);
  });

  it("creates no elements from the name", () => {
    expect($("#result h2")?.children.length).toBe(0);
    expect($("#result img, #result script")).toBeNull();
    expect(document.querySelectorAll("img, script")).toHaveLength(0);
  });

  it("keeps the exact name in the marker tooltips", () => {
    expect(($(".tick.p") as HTMLElement).title).toBe(`${HOSTILE}: 100`);
  });

  it("shows the name as text in the dropdown list too", () => {
    const primary = $("#primary") as HTMLInputElement;
    primary.dispatchEvent(new Event("focus"));
    const item = [...document.querySelectorAll("#primary-list li")].find(li => li.textContent === HOSTILE);
    expect(item).toBeDefined();
    expect(item?.children.length).toBe(0);
  });
});

describe("results card content", () => {
  it("shows six stat rows plus a header row", () => {
    expect(document.querySelectorAll("#result .stat")).toHaveLength(7);
  });

  it("shows the primary Pokémon's first type as the first chip", () => {
    expect($("#result .type")?.textContent).toBe("Fire");
  });

  it("shows a total at the chosen level", () => {
    expect($("#result .total")?.textContent).toMatch(/^Total at Lv 50: [\d,]+$/);
  });
});

describe("passive ability", () => {
  const toggle = () => $("#passive-unlocked") as HTMLInputElement;
  const setUnlocked = (value: boolean) => {
    toggle().checked = value;
    toggle().dispatchEvent(new Event("change", { bubbles: true }));
  };
  const passiveText = () => $("#result .passive")?.textContent;

  it("is locked by default and shows nothing", () => {
    expect(toggle().checked).toBe(false);
    expect($("#result .passive")).toBeNull();
  });

  it("shows the primary Pokémon's passive once unlocked, never the secondary's", () => {
    setUnlocked(true);
    expect(passiveText()).toBe(`Passive: ${HOSTILE_PASSIVE}`);
    expect(passiveText()).not.toContain("Passive B");
  });

  it("shows the passive as plain text, never as HTML", () => {
    expect($("#result .passive")?.querySelectorAll("b")).toHaveLength(1); // only the bold "Passive:" label
    expect($("#result .passive img")).toBeNull();
  });

  it("follows the primary Pokémon when the two are swapped", () => {
    ($("#swap") as HTMLButtonElement).click();
    expect(passiveText()).toBe("Passive: Passive B");
    ($("#swap") as HTMLButtonElement).click();
    expect(passiveText()).toBe(`Passive: ${HOSTILE_PASSIVE}`);
  });

  it("disappears again when locked", () => {
    setUnlocked(false);
    expect($("#result .passive")).toBeNull();
  });
});

describe("fused ability (taken from the secondary Pokémon)", () => {
  const select = () => $("#ability") as HTMLSelectElement;
  const options = () => [...select().options].map(o => o.textContent);
  const abilityText = () => $("#result .ability")?.textContent;
  const choose = (value: string) => {
    select().value = value;
    select().dispatchEvent(new Event("change", { bubbles: true }));
  };
  const swap = () => ($("#swap") as HTMLButtonElement).click();

  it("offers the secondary Pokémon's regular and hidden abilities", () => {
    expect(select().disabled).toBe(false);
    expect(options()).toEqual(["Ability B", "Ability C", "Hidden B (Hidden)"]);
  });

  it("starts on the first ability and shows it on the fused Pokémon", () => {
    expect(abilityText()).toBe("Ability: Ability B");
  });

  it("shows whichever ability the user picks, including the hidden one", () => {
    choose("1");
    expect(abilityText()).toBe("Ability: Ability C");
    choose("2");
    expect(abilityText()).toBe("Ability: Hidden B (Hidden)");
  });

  it("keeps the choice when other inputs change", () => {
    const level = $("#level") as HTMLInputElement;
    level.value = "70";
    level.dispatchEvent(new Event("input", { bubbles: true }));
    expect(select().value).toBe("2");
    expect(abilityText()).toBe("Ability: Hidden B (Hidden)");
  });

  it("is shown whether or not the passive is unlocked, and next to it when it is", () => {
    expect($("#result .passive")).toBeNull();
    const toggle = $("#passive-unlocked") as HTMLInputElement;
    toggle.checked = true;
    toggle.dispatchEvent(new Event("change", { bubbles: true }));
    expect(abilityText()).toBe("Ability: Hidden B (Hidden)");
    expect($("#result .passive")?.textContent).toBe(`Passive: ${HOSTILE_PASSIVE}`);
    toggle.checked = false;
    toggle.dispatchEvent(new Event("change", { bubbles: true }));
  });

  it("switches to the new secondary Pokémon's abilities when swapped, never the old one's", () => {
    swap();
    expect(options()).toEqual([HOSTILE_ABILITY]);
    expect(abilityText()).toBe(`Ability: ${HOSTILE_ABILITY}`);
    expect(abilityText()).not.toContain("Ability B");
  });

  it("shows ability names as plain text, never as HTML", () => {
    expect($("#result .ability")?.querySelectorAll("b")).toHaveLength(1); // only the bold "Ability:" label
    expect($("#result .ability i, #result .ability img")).toBeNull();
    expect(select().querySelector("option i, option img")).toBeNull();
  });

  it("resets to the first ability after swapping back", () => {
    swap();
    expect(options()).toEqual(["Ability B", "Ability C", "Hidden B (Hidden)"]);
    expect(select().value).toBe("0");
    expect(abilityText()).toBe("Ability: Ability B");
  });
});
