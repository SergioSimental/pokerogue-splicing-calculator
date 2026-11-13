// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { fusedSpeciesName } from "../src/fusionName.js";

// A name full of characters that would break or inject markup if it were ever treated as HTML.
const HOSTILE = `<img src=x onerror="alert(1)"> & <script>alert(2)</script> "quoted" 'single'`;

const HOSTILE_PASSIVE = `Passive <b>A</b> & <img src=x>`;
const HOSTILE_ABILITY = `Ability <i>A</i> & <img src=x>`;

const dex = [
  { name: HOSTILE, stats: [100, 90, 80, 70, 60, 50], types: ["Fire", "Flying"], passive: HOSTILE_PASSIVE, abilities: { regular: [HOSTILE_ABILITY], hidden: null }, fusionName: HOSTILE, canEvolve: true, isMax: false },
  { name: "Safe Mon", stats: [50, 50, 50, 50, 50, 50], types: ["Water"], passive: "Passive B", abilities: { regular: ["Ability B", "Ability C"], hidden: "Hidden B" }, fusionName: "Safe Mon", canEvolve: false, isMax: false },
  { name: "Pikachu (Cosplay)", stats: [50, 50, 50, 50, 50, 50], types: ["Normal"], passive: "Passive", abilities: { regular: ["Ability"], hidden: null }, fusionName: "Pikachu (Cosplay)", canEvolve: true, isMax: false },
  { name: "Raichu", stats: [50, 50, 50, 50, 50, 50], types: ["Normal"], passive: "Passive", abilities: { regular: ["Ability"], hidden: null }, fusionName: "Raichu", canEvolve: false, isMax: false },
  { name: "Ditto", stats: [50, 50, 50, 50, 50, 50], types: ["Normal"], passive: "Passive", abilities: { regular: ["Ability"], hidden: null }, fusionName: "Ditto", canEvolve: false, isMax: false },
  { name: "Alolan Marowak", stats: [50, 50, 50, 50, 50, 50], types: ["Normal"], passive: "Passive", abilities: { regular: ["Ability"], hidden: null }, fusionName: "Alolan Marowak", canEvolve: false, isMax: false },
  { name: "Clamperl", stats: [50, 50, 50, 50, 50, 50], types: ["Normal"], passive: "Passive", abilities: { regular: ["Ability"], hidden: null }, fusionName: "Clamperl", canEvolve: true, isMax: false },
  { name: "Mega Mon (Mega X)", stats: [190, 190, 190, 190, 190, 190], types: ["Normal"], passive: "Passive", abilities: { regular: ["Ability"], hidden: null }, fusionName: "Mega Mon", canEvolve: false, isMax: false },
  { name: "Odd Mon (Primal)", stats: [200, 200, 200, 200, 200, 200], types: ["Normal"], passive: "Passive", abilities: { regular: ["Ability"], hidden: null }, fusionName: "Odd Mon", canEvolve: false, isMax: false },
  { name: "Gmax Mon", stats: [180, 180, 180, 180, 180, 180], types: ["Normal"], passive: "Passive", abilities: { regular: ["Ability"], hidden: null }, fusionName: "G-Max Mon", canEvolve: true, isMax: true },
  { name: "Colossus", stats: [250, 250, 250, 250, 250, 250], types: ["Normal"], passive: "Passive", abilities: { regular: ["Ability"], hidden: null }, fusionName: "Colossus", canEvolve: false, isMax: false },
  { name: "Brute", stats: [50, 50, 50, 50, 50, 50], types: ["Normal"], passive: "Hustle", abilities: { regular: ["Huge Power", "Pure Power"], hidden: "Wonder Guard" }, fusionName: "Brute", canEvolve: false, isMax: false },
  { name: "Echo", stats: [50, 50, 50, 50, 50, 50], types: ["Normal"], passive: "Huge Power", abilities: { regular: ["Huge Power"], hidden: null }, fusionName: "Echo", canEvolve: false, isMax: false },
  { name: "Guardian", stats: [50, 50, 50, 50, 50, 50], types: ["Normal"], passive: "Wonder Guard", abilities: { regular: ["Ability"], hidden: null }, fusionName: "Guardian", canEvolve: false, isMax: false },
];

const $ = (selector: string) => document.querySelector(selector);

/** Picks a Pokémon (or nature) by typing part of its name into a combo box and pressing Enter. */
const pick = (selector: string, text: string) => {
  const input = $(selector) as HTMLInputElement;
  input.dispatchEvent(new Event("focus"));
  input.value = text;
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
};
const setNumber = (id: string, value: string) => {
  const input = $(`#${id}`) as HTMLInputElement;
  input.value = value;
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
};
const tick = (id: string, on = true) => {
  const box = $(`#${id}`) as HTMLInputElement;
  box.checked = on;
  box.dispatchEvent(new Event("change", { bubbles: true }));
};
const statCells = () => [...document.querySelectorAll<HTMLElement>("#result .stat:not(.labels) .lvl")];
/** The six stats as shown (HP first), without the in-battle arrows. */
const shown = () => statCells().map(c => Number((c.firstChild?.textContent ?? "").replace(/,/g, "")));
/** The in-battle arrow text of each stat, or null where there is none. */
const arrows = () => statCells().map(c => c.querySelector(".battle")?.textContent ?? null);
const totalLine = () => $("#result .total")?.textContent;
/** Back to level 50, 31 IVs, a neutral nature, no held items and nothing ticked (earlier groups leave things changed). */
const resetCalculator = () => {
  setNumber("level", "50");
  for (let i = 0; i < 6; i++) setNumber(`iv${i}`, "31");
  for (const prefix of ["", "secondary-"]) {
    setNumber(`${prefix}soul-dew`, "0");
    setNumber(`${prefix}macho-brace`, "0");
    for (let i = 0; i < 6; i++) setNumber(`${prefix}vitamin${i}`, "0");
    for (const box of document.querySelectorAll<HTMLInputElement>(`#${prefix}eviolite, #${prefix}species-items input`)) tick(box.id, false);
    for (const id of ["sweet-shuckle-juice", "foul-shuckle-juice", "old-gateau"]) tick(`${prefix}${id}`, false);
  }
  pick("#nature", "hardy");
  tick("passive-unlocked", false);
};

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
  it("shows the fused name in the heading and the exact parent names under it", () => {
    expect($("#result h2")?.textContent).toBe(fusedSpeciesName(HOSTILE, "Safe Mon"));
    expect($("#result .parents")?.textContent).toBe(`${HOSTILE} + Safe Mon`);
  });

  it("creates no elements from the name", () => {
    expect($("#result h2")?.children.length).toBe(0);
    expect($("#result .parents")?.children.length).toBe(0);
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

describe("fused name", () => {
  const headline = () => $("#result h2")?.textContent;
  const swap = () => ($("#swap") as HTMLButtonElement).click();

  it("is built from the primary Pokémon's name first, then the secondary's", () => {
    expect(headline()).toBe(fusedSpeciesName(HOSTILE, "Safe Mon"));
  });

  it("changes order when the two are swapped", () => {
    swap();
    expect(headline()).toBe(fusedSpeciesName("Safe Mon", HOSTILE));
    expect($("#result .parents")?.textContent).toBe(`Safe Mon + ${HOSTILE}`);
    swap();
    expect(headline()).toBe(fusedSpeciesName(HOSTILE, "Safe Mon"));
  });

  it("is plain text, never HTML", () => {
    expect($("#result h2 img, #result h2 script")).toBeNull();
  });
});

describe("held item boxes", () => {
  const input = (id: string) => $(`#${id}`) as HTMLInputElement;
  const ids = ["soul-dew", "macho-brace", "vitamin0", "vitamin1", "vitamin2", "vitamin3", "vitamin4", "vitamin5"];
  const maxes = [10, 50, 31, 31, 31, 31, 31, 31];
  const change = (id: string, value: string) => {
    input(id).value = value;
    input(id).dispatchEvent(new Event("input", { bubbles: true }));
    input(id).dispatchEvent(new Event("change", { bubbles: true }));
  };

  it("has a Soul Dew box, a Macho Brace box and six vitamin boxes, all starting at 0", () => {
    expect($(".itemrow fieldset legend")?.textContent).toBe("Primary's held items");
    expect(($(".itemrow fieldset") as HTMLElement).querySelectorAll("input[type=number]")).toHaveLength(8);
    for (const id of ids) expect(input(id).value, id).toBe("0");
  });

  it("limits each box to the game's stack limit", () => {
    ids.forEach((id, i) => expect(input(id).max, id).toBe(String(maxes[i])));
  });

  it("labels the vitamins in stat order: HP Up, Protein, Iron, Calcium, Zinc, Carbos", () => {
    const labels = [0, 1, 2, 3, 4, 5].map(i => input(`vitamin${i}`).closest("label")?.textContent);
    expect(labels).toEqual(["HP Up", "Protein", "Iron", "Calcium", "Zinc", "Carbos"]);
  });

  it("explains what each kind of item changes", () => {
    const hint = $("#item-help .hint")?.textContent ?? "";
    expect(hint).toContain("Vitamins, Soul Dew and Macho Brace change the stat shown");
    expect(hint).toContain("only apply in battle");
  });

  it("pulls too-large, negative, empty and fractional entries back into range", () => {
    change("soul-dew", "99");
    expect(input("soul-dew").value).toBe("10");
    change("macho-brace", "75");
    expect(input("macho-brace").value).toBe("50");
    change("vitamin3", "40");
    expect(input("vitamin3").value).toBe("31");
    change("vitamin0", "-5");
    expect(input("vitamin0").value).toBe("0");
    change("vitamin1", "");
    expect(input("vitamin1").value).toBe("0");
    change("vitamin2", "7.9");
    expect(input("vitamin2").value).toBe("7");
  });

  it("accepts digits but blocks letters and symbols as they are typed", () => {
    const press = (key: string) => {
      const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true });
      input("soul-dew").dispatchEvent(event);
      return event.defaultPrevented;
    };
    expect(press("5")).toBe(false);
    for (const key of ["e", "-", "+", "."]) expect(press(key), key).toBe(true);
  });

  it("puts every box back to 0 afterwards", () => {
    for (const id of ids) change(id, "0");
    for (const id of ids) expect(input(id).value, id).toBe("0");
  });
});

// The default pair is the hostile Pokémon + Safe Mon: fused base stats 75, 70, 65, 60, 55, 50 at level 50
// with 31 IVs and a neutral nature. The expected numbers come from an independent port of the game's formula
// (tests/fixtures/make-stat-cases.py).
describe("held items change the stats shown", () => {
  const PLAIN = [150, 90, 85, 80, 75, 70];
  const NO_ARROWS = [null, null, null, null, null, null];
  const vitamins = [0, 1, 2, 3, 4, 5].map(i => `vitamin${i}`);

  beforeEach(resetCalculator);

  it("shows the plain stats while every box is empty", () => {
    expect(shown()).toEqual(PLAIN);
    expect(arrows()).toEqual(NO_ARROWS);
    expect(totalLine()).toBe("Total at Lv 50: 550");
  });

  it("adds Macho Brace to every stat, with its 50-stack bonus", () => {
    setNumber("macho-brace", "50");
    expect(shown()).toEqual([275, 147, 141, 136, 131, 126]);
    expect(totalLine()).toBe("Total at Lv 50: 956");
  });

  it("raises each stat with its own vitamin", () => {
    for (const id of vitamins) setNumber(id, "10");
    expect(shown()).toEqual([225, 160, 150, 140, 130, 120]);
    for (const id of vitamins) setNumber(id, "0");
    setNumber("vitamin0", "31");
    expect(shown()).toEqual([382, 90, 85, 80, 75, 70]);
  });

  it("stops counting a vitamin beyond that stat's IV", () => {
    setNumber("iv1", "5");
    setNumber("vitamin1", "31");
    expect(shown()).toEqual([150, 112, 85, 80, 75, 70]);
    setNumber("vitamin1", "5");
    expect(shown()).toEqual([150, 112, 85, 80, 75, 70]);
  });

  it("widens the nature with Soul Dew, but only for a stat the nature touches", () => {
    pick("#nature", "adamant"); // +Atk, -SpA
    expect(shown()).toEqual([150, 100, 85, 72, 75, 70]);
    setNumber("soul-dew", "5");
    expect(shown()).toEqual([150, 144, 85, 32, 75, 70]);
    setNumber("soul-dew", "10");
    expect(shown()).toEqual([150, 189, 85, 1, 75, 70]);
    pick("#nature", "hardy");
    expect(shown()).toEqual(PLAIN);
  });

  it("updates as the number is typed, before the box loses focus", () => {
    const box = $("#macho-brace") as HTMLInputElement;
    box.value = "50";
    box.dispatchEvent(new Event("input", { bubbles: true }));
    expect(shown()).toEqual([275, 147, 141, 136, 131, 126]);
  });

  it("uses the limit when the typed number is too large", () => {
    setNumber("macho-brace", "75");
    expect(shown()).toEqual([275, 147, 141, 136, 131, 126]);
  });

  it("does not show an in-battle arrow for these items, since they are part of the stat itself", () => {
    setNumber("macho-brace", "50");
    for (const id of vitamins) setNumber(id, "10");
    expect(arrows()).toEqual(NO_ARROWS);
  });
});

describe("Eviolite and species items, one set per Pokémon", () => {
  const box = (id: string) => $(`#${id}`) as HTMLInputElement;
  const shownIn = (prefix: string) =>
    [...document.querySelectorAll<HTMLLabelElement>(`#${prefix}species-items label`)].filter(l => !l.hidden).map(l => l.querySelector("b")?.textContent);
  const primarySpecies = () => shownIn("");
  const secondarySpecies = () => shownIn("secondary-");
  const section = (prefix: string) => $(`#${prefix}species-items`) as HTMLElement;

  beforeEach(resetCalculator);

  it("shows Eviolite for both Pokémon, unticked, with its Gigantamax note", () => {
    for (const id of ["eviolite", "secondary-eviolite"]) {
      expect(box(id).type).toBe("checkbox");
      expect(box(id).checked).toBe(false);
      expect(box(id).closest("label")?.title).toContain("No effect on Gigantamaxed Pokémon");
    }
  });

  it("has a held items section for each Pokémon", () => {
    const legends = [...document.querySelectorAll(".itemrow fieldset legend")].map(l => l.textContent);
    expect(legends).toEqual(["Primary's held items", "Secondary's held items"]);
    expect(document.querySelectorAll("#secondary-soul-dew, #secondary-macho-brace, [id^=secondary-vitamin]")).toHaveLength(8);
  });

  it("shows no species items, and no heading for them, when neither Pokémon can use one", () => {
    pick("#primary", "img");
    pick("#secondary", "safe");
    expect(section("").hidden).toBe(true);
    expect(section("secondary-").hidden).toBe(true);
    expect(primarySpecies()).toEqual([]);
    expect(secondarySpecies()).toEqual([]);
  });

  it("offers an item only in the section of the Pokémon that can use it", () => {
    pick("#primary", "pikachu (cosplay)");
    pick("#secondary", "safe");
    expect(primarySpecies()).toEqual(["Light Ball"]);
    expect(secondarySpecies()).toEqual([]);
    expect(section("secondary-").hidden).toBe(true);
    pick("#primary", "img");
    pick("#secondary", "pikachu");
    expect(primarySpecies()).toEqual([]);
    expect(secondarySpecies()).toEqual(["Light Ball"]);
  });

  it("offers each item only for its own species", () => {
    pick("#primary", "img");
    pick("#secondary", "ditto");
    expect(secondarySpecies()).toEqual(["Metal Powder", "Quick Powder"]);
    pick("#secondary", "clamperl");
    expect(secondarySpecies()).toEqual(["Deep Sea Tooth", "Deep Sea Scale"]);
    pick("#secondary", "alolan marowak");
    expect(secondarySpecies()).toEqual(["Thick Club"]);
    pick("#secondary", "raichu");
    expect(secondarySpecies()).toEqual([]);
    expect(section("secondary-").hidden).toBe(true);
  });

  it("fills both sections when both Pokémon can use items", () => {
    pick("#primary", "pikachu");
    pick("#secondary", "ditto");
    expect(primarySpecies()).toEqual(["Light Ball"]);
    expect(secondarySpecies()).toEqual(["Metal Powder", "Quick Powder"]);
  });

  it("keeps a ticked item while its Pokémon stays picked and unticks it once another Pokémon replaces it", () => {
    pick("#primary", "pikachu");
    pick("#secondary", "safe");
    tick("item-light-ball");
    pick("#secondary", "ditto");
    expect(box("item-light-ball").checked).toBe(true);
    pick("#primary", "img");
    expect(primarySpecies()).toEqual([]);
    expect(box("item-light-ball").checked).toBe(false);
    pick("#primary", "pikachu");
    expect(box("item-light-ball").checked).toBe(false); // cleared, not just hidden
  });

  it("does not touch the Eviolite boxes when the Pokémon change", () => {
    tick("eviolite");
    tick("secondary-eviolite");
    pick("#primary", "pikachu");
    pick("#secondary", "ditto");
    expect(box("eviolite").checked).toBe(true);
    expect(box("secondary-eviolite").checked).toBe(true);
  });

  it("keeps each Pokémon's items with it when the two are swapped", () => {
    pick("#primary", "pikachu");
    pick("#secondary", "ditto");
    tick("item-light-ball");
    tick("secondary-item-metal-powder");
    tick("eviolite");
    setNumber("macho-brace", "20");
    setNumber("secondary-soul-dew", "6");
    setNumber("secondary-vitamin1", "9");
    ($("#swap") as HTMLButtonElement).click();
    // Ditto is now the primary Pokémon and brought its items along, and so did Pikachu.
    expect(primarySpecies()).toEqual(["Metal Powder", "Quick Powder"]);
    expect(secondarySpecies()).toEqual(["Light Ball"]);
    expect(box("item-metal-powder").checked).toBe(true);
    expect(box("secondary-item-light-ball").checked).toBe(true);
    expect(box("secondary-eviolite").checked).toBe(true);
    expect(box("eviolite").checked).toBe(false);
    expect(box("secondary-macho-brace").value).toBe("20");
    expect(box("macho-brace").value).toBe("0");
    expect(box("soul-dew").value).toBe("6");
    expect(box("vitamin1").value).toBe("9");
    ($("#swap") as HTMLButtonElement).click();
    expect(box("item-light-ball").checked).toBe(true);
    expect(box("macho-brace").value).toBe("20");
    expect(box("secondary-vitamin1").value).toBe("9");
  });

  it("puts the default pair back for the next group", () => {
    pick("#primary", "img");
    pick("#secondary", "safe");
    expect(primarySpecies()).toEqual([]);
    expect(secondarySpecies()).toEqual([]);
  });
});

// Every Pokémon in this group has base stats of 50, so at level 50 with 31 IVs the fused stats are
// [125, 70, 70, 70, 70, 70] (total 475). Eviolite and species items work on top of that in battle.
describe("Eviolite and species items change the in-battle stats", () => {
  const PLAIN = [125, 70, 70, 70, 70, 70];
  const NO_ARROWS = [null, null, null, null, null, null];

  beforeEach(resetCalculator);

  it("gives Eviolite's full boost (x1.5) when both Pokémon can still evolve", () => {
    pick("#primary", "pikachu (cosplay)");
    pick("#secondary", "clamperl");
    expect(arrows()).toEqual(NO_ARROWS);
    tick("eviolite");
    expect(shown()).toEqual(PLAIN); // the stat itself does not change
    expect(arrows()).toEqual([null, null, "\u2192 105", null, "\u2192 105", null]);
    expect(totalLine()).toBe("Total at Lv 50: 475 (545 in battle)");
    expect($("#result .legend")?.textContent).toContain("An arrow shows the in-battle value");
  });

  it("gives half the boost (x1.25) when only one of them can", () => {
    pick("#primary", "pikachu (cosplay)");
    pick("#secondary", "ditto");
    tick("eviolite");
    expect(arrows()).toEqual([null, null, "\u2192 87", null, "\u2192 87", null]);
    pick("#primary", "ditto");
    pick("#secondary", "pikachu (cosplay)");
    expect(arrows()).toEqual([null, null, "\u2192 87", null, "\u2192 87", null]);
  });

  it("gives nothing when neither can evolve", () => {
    pick("#primary", "raichu");
    pick("#secondary", "ditto");
    tick("eviolite");
    expect(arrows()).toEqual(NO_ARROWS);
    expect(totalLine()).toBe("Total at Lv 50: 475");
    expect($("#result .legend")?.textContent).not.toContain("arrow");
  });

  it("gives nothing when either Pokémon is a Gigantamax form", () => {
    pick("#primary", "pikachu (cosplay)");
    pick("#secondary", "gmax");
    tick("eviolite");
    expect(arrows()).toEqual(NO_ARROWS);
    pick("#primary", "gmax");
    pick("#secondary", "pikachu (cosplay)");
    expect(arrows()).toEqual(NO_ARROWS);
  });

  it("doubles the stats of a ticked species item", () => {
    pick("#primary", "pikachu (cosplay)");
    pick("#secondary", "raichu");
    tick("item-light-ball");
    expect(shown()).toEqual(PLAIN);
    expect(arrows()).toEqual([null, "\u2192 140", null, "\u2192 140", null, null]);
    tick("item-light-ball", false);
    expect(arrows()).toEqual(NO_ARROWS);

    pick("#primary", "raichu");
    pick("#secondary", "ditto");
    tick("secondary-item-metal-powder");
    expect(arrows()).toEqual([null, null, "\u2192 140", null, null, null]);
    tick("secondary-item-quick-powder");
    expect(arrows()).toEqual([null, null, "\u2192 140", null, null, "\u2192 140"]);
  });

  it("stacks items that boost the same stat, Eviolite included", () => {
    pick("#primary", "pikachu (cosplay)");
    pick("#secondary", "clamperl");
    for (const id of ["eviolite", "item-light-ball", "secondary-item-deep-sea-tooth", "secondary-item-deep-sea-scale"]) tick(id);
    // Atk x2 (Light Ball), Def x1.5 (Eviolite), SpA x4 (Light Ball and Deep Sea Tooth), SpD x3 (Eviolite and Deep Sea Scale)
    expect(arrows()).toEqual([null, "\u2192 140", "\u2192 105", "\u2192 280", "\u2192 210", null]);
    expect(totalLine()).toBe("Total at Lv 50: 475 (930 in battle)");
  });

  it("works on top of the stat with Macho Brace already added", () => {
    pick("#primary", "pikachu (cosplay)");
    pick("#secondary", "clamperl");
    setNumber("macho-brace", "50");
    tick("eviolite");
    expect(shown()).toEqual([247, 126, 126, 126, 126, 126]);
    expect(arrows()).toEqual([null, null, "\u2192 189", null, "\u2192 189", null]);
  });

  it("drops the arrow as soon as the item no longer applies to the picked pair", () => {
    pick("#primary", "pikachu (cosplay)");
    pick("#secondary", "raichu");
    tick("item-light-ball");
    expect(arrows()).toEqual([null, "\u2192 140", null, "\u2192 140", null, null]);
    pick("#primary", "raichu");
    expect(arrows()).toEqual(NO_ARROWS);
    pick("#primary", "pikachu (cosplay)");
    expect(arrows()).toEqual(NO_ARROWS); // the item was cleared, not just hidden
  });

  it("puts the default pair back", () => {
    pick("#primary", "img");
    pick("#secondary", "safe");
    expect(shown()).toEqual([150, 90, 85, 80, 75, 70]);
  });
});

// The default pair (the hostile Pokémon + Safe Mon) fuses to base stats 75, 70, 65, 60, 55, 50: at level 50 with
// 31 IVs and a neutral nature that is [150, 90, 85, 80, 75, 70]. The numbers below come from the independent
// reference (tests/fixtures/make-stat-cases.py). The game moves the secondary's items onto the primary on fusion.
describe("the two Pokémon's items combine when they fuse", () => {
  const PLAIN = [150, 90, 85, 80, 75, 70];
  const holding = () => $("#result .holding")?.textContent ?? null;
  const input = (id: string) => $(`#${id}`) as HTMLInputElement;

  beforeEach(() => {
    resetCalculator();
    pick("#primary", "img");
    pick("#secondary", "safe");
  });

  it("says nothing about held items while neither Pokémon holds any", () => {
    expect(holding()).toBeNull();
    expect(shown()).toEqual(PLAIN);
  });

  it("lists what the fused Pokémon holds, and clears the list when the boxes are emptied", () => {
    setNumber("macho-brace", "25");
    expect(holding()).toBe("Holds after fusing: Macho Brace 25");
    setNumber("macho-brace", "0");
    expect(holding()).toBeNull();
  });

  it("adds both Macho Brace stacks, up to the limit of 50", () => {
    setNumber("macho-brace", "10");
    setNumber("secondary-macho-brace", "15");
    expect(shown()).toEqual([200, 115, 110, 105, 100, 95]); // 25 stacks
    expect(holding()).toBe("Holds after fusing: Macho Brace 25 (10 + 15)");
    setNumber("macho-brace", "30");
    setNumber("secondary-macho-brace", "25");
    expect(shown()).toEqual([275, 147, 141, 136, 131, 126]); // 50 stacks, with the full-stack bonus
    expect(holding()).toBe("Holds after fusing: Macho Brace 50 (30 + 25, limit 50)");
  });

  it("uses the secondary's items even when the primary holds none", () => {
    setNumber("secondary-macho-brace", "50");
    expect(shown()).toEqual([275, 147, 141, 136, 131, 126]);
    expect(holding()).toBe("Holds after fusing: Macho Brace 50 (from the secondary)");
  });

  it("does not use the secondary's items for the stats it shows before fusing: only the fused result is shown", () => {
    setNumber("secondary-macho-brace", "50");
    expect(document.querySelectorAll("#result .stat:not(.labels)")).toHaveLength(6);
    expect($("#result h2")?.textContent).toBe(fusedSpeciesName(HOSTILE, "Safe Mon"));
  });

  it("adds Soul Dew stacks and applies them to the nature", () => {
    pick("#nature", "adamant"); // +Atk, -SpA
    setNumber("soul-dew", "4");
    setNumber("secondary-soul-dew", "3");
    expect(shown()).toEqual([150, 163, 85, 15, 75, 70]); // 7 stacks
    setNumber("secondary-soul-dew", "10");
    expect(shown()).toEqual([150, 189, 85, 1, 75, 70]); // 4 + 10 is limited to 10
  });

  it("adds the vitamins of the same stat and no others", () => {
    setNumber("vitamin1", "3");
    setNumber("secondary-vitamin1", "4");
    setNumber("secondary-vitamin2", "9");
    // Protein: 3 + 4 = 7 stacks on Atk. Iron: only the secondary's 9 stacks, on Def. HP and the rest are untouched.
    expect(shown()).toEqual([150, 139, 143, 80, 75, 70]);
    expect(holding()).toBe("Holds after fusing: Protein 7 (3 + 4); Iron 9 (from the secondary)");
  });

  it("stops the combined vitamins at the primary's IV for that stat", () => {
    setNumber("iv1", "5");
    setNumber("vitamin1", "4");
    setNumber("secondary-vitamin1", "4");
    expect(shown()).toEqual([150, 112, 85, 80, 75, 70]);
    expect(holding()).toBe("Holds after fusing: Protein 5 (4 + 4, limit 5)");
  });

  // The fused Pokémon keeps the primary's IVs, so both boxes stop at the primary's IV and nothing can pass it.
  it("limits both Pokémon's vitamin boxes to the primary's IV for each stat", () => {
    setNumber("iv1", "5");
    expect(input("vitamin1").max).toBe("5");
    expect(input("secondary-vitamin1").max).toBe("5");
    expect(input("vitamin2").max).toBe("31");
    expect(input("secondary-vitamin2").max).toBe("31");
    setNumber("vitamin1", "20");
    setNumber("secondary-vitamin1", "20");
    expect(input("vitamin1").value).toBe("5");
    expect(input("secondary-vitamin1").value).toBe("5");
    expect(shown()).toEqual([150, 112, 85, 80, 75, 70]);
    expect(holding()).toBe("Holds after fusing: Protein 5 (5 + 5, limit 5)");
  });

  it("pulls the secondary's vitamin box down too when the primary's IV is lowered", () => {
    setNumber("secondary-vitamin3", "20");
    setNumber("iv3", "8");
    expect(input("secondary-vitamin3").value).toBe("8");
    expect(holding()).toBe("Holds after fusing: Calcium 8 (from the secondary)");
  });

  it("holds a typed vitamin count to the IV straight away, before the box loses focus", () => {
    setNumber("iv1", "5");
    const box = input("vitamin1");
    box.value = "20";
    box.dispatchEvent(new Event("input", { bubbles: true })); // typing, no change event yet
    expect(shown()).toEqual([150, 112, 85, 80, 75, 70]); // counted as 5, the IV
  });

  it("holds a vitamin count typed into the secondary's box to the primary's IV straight away too", () => {
    setNumber("iv1", "5");
    const box = input("secondary-vitamin1");
    box.value = "20";
    box.dispatchEvent(new Event("input", { bubbles: true })); // typing, no change event yet
    expect(shown()).toEqual([150, 112, 85, 80, 75, 70]);
  });

  it("pulls a primary vitamin box down when its IV is lowered afterwards", () => {
    setNumber("vitamin3", "20");
    expect(input("vitamin3").value).toBe("20");
    setNumber("iv3", "8");
    expect(input("vitamin3").value).toBe("8");
    expect(input("vitamin3").max).toBe("8");
    setNumber("iv3", "31");
    expect(input("vitamin3").max).toBe("31");
    expect(input("vitamin3").value).toBe("8"); // not restored
  });

  it("applies Eviolite once if either Pokémon holds it, or both", () => {
    pick("#primary", "pikachu (cosplay)");
    pick("#secondary", "clamperl"); // both can still evolve, every stat 50: plain stats 125, 70, 70, 70, 70, 70
    tick("secondary-eviolite");
    expect(arrows()).toEqual([null, null, "→ 105", null, "→ 105", null]);
    expect(holding()).toBe("Holds after fusing: Eviolite (from the secondary)");
    tick("eviolite");
    expect(arrows()).toEqual([null, null, "→ 105", null, "→ 105", null]); // not x1.5 twice
    expect(holding()).toBe("Holds after fusing: Eviolite");
  });

  // Every item doubles exactly its own stats (50-stat Pokémon: plain stats 125, 70, 70, 70, 70, 70, so 140 once doubled).
  it.each([
    ["light-ball", "pikachu (cosplay)", [null, "→ 140", null, "→ 140", null, null]],
    ["thick-club", "alolan marowak", [null, "→ 140", null, null, null, null]],
    ["metal-powder", "ditto", [null, null, "→ 140", null, null, null]],
    ["quick-powder", "ditto", [null, null, null, null, null, "→ 140"]],
    ["deep-sea-tooth", "clamperl", [null, null, null, "→ 140", null, null]],
    ["deep-sea-scale", "clamperl", [null, null, null, null, "→ 140", null]],
  ])("%s doubles only its own stats, held by the primary or by the secondary", (id, species, expected) => {
    pick("#primary", species);
    pick("#secondary", "safe");
    tick(`item-${id}`);
    expect(arrows()).toEqual(expected);
    tick(`item-${id}`, false);
    pick("#primary", "safe");
    pick("#secondary", species);
    tick(`secondary-item-${id}`);
    expect(arrows()).toEqual(expected);
  });

  it("applies a species item held by the secondary, since the fused Pokémon is also that species", () => {
    pick("#primary", "raichu");
    pick("#secondary", "pikachu (cosplay)");
    tick("secondary-item-light-ball");
    expect(arrows()).toEqual([null, "→ 140", null, "→ 140", null, null]);
    expect(holding()).toBe("Holds after fusing: Light Ball (from the secondary)");
  });
});

// Shuckle Juice and Old Gateau change the primary's own base stats before the two Pokémon are averaged.
// Expected values come from the independent reference (tests/fixtures/make-stat-cases.py, "base" mode).
describe("Shuckle Juice and Old Gateau change the fused base stats", () => {
  const holding = () => $("#result .holding")?.textContent ?? null;
  const fill = (i: number) => (document.querySelectorAll<HTMLElement>("#result .stat:not(.labels) .fill")[i])?.style.getPropertyValue("--pos");

  beforeEach(() => {
    resetCalculator();
    pick("#primary", "img");
    pick("#secondary", "safe");
  });

  it("Sweet Shuckle Juice raises the primary's base stats", () => {
    tick("sweet-shuckle-juice");
    expect(shown()).toEqual([153, 95, 90, 85, 80, 75]);
    expect(holding()).toBe("Holds after fusing: Sweet Shuckle Juice");
  });

  it("Foul Shuckle Juice lowers them, and both together net out", () => {
    tick("foul-shuckle-juice");
    expect(shown()).toEqual([146, 83, 78, 73, 68, 63]);
    tick("sweet-shuckle-juice");
    expect(shown()).toEqual([149, 88, 83, 78, 73, 68]);
  });

  it("Old Gateau lifts the lower of HP/Spe, Atk/SpA and Def/SpD", () => {
    tick("old-gateau");
    expect(shown()).toEqual([150, 90, 85, 90, 85, 80]);
    expect(holding()).toBe("Holds after fusing: Old Gateau");
  });

  it("uses the secondary's item, but only the primary's stats decide what it does", () => {
    tick("secondary-old-gateau");
    expect(shown()).toEqual([150, 90, 85, 90, 85, 80]);
    expect(holding()).toBe("Holds after fusing: Old Gateau (from the secondary)");
    pick("#primary", "safe"); // ties: the later stat of each pair is lifted
    pick("#secondary", "img");
    expect(shown()).toEqual([150, 90, 85, 90, 85, 80]);
  });

  it("stacks with vitamins, which apply to the fused base stat afterwards", () => {
    tick("sweet-shuckle-juice");
    setNumber("vitamin1", "10");
    expect(shown()).toEqual([153, 170, 90, 85, 80, 75]);
  });

  it("swapping the Pokémon takes the ticked items with them", () => {
    const box = (id: string) => document.getElementById(id) as HTMLInputElement;
    const ids = ["sweet-shuckle-juice", "foul-shuckle-juice", "old-gateau"];
    for (const id of ids) tick(id);
    ($("#swap") as HTMLElement).click();
    for (const id of ids) {
      expect(box(`secondary-${id}`).checked, id).toBe(true);
      expect(box(id).checked, id).toBe(false);
    }
    ($("#swap") as HTMLElement).click();
    for (const id of ids) {
      expect(box(id).checked, id).toBe(true);
      expect(box(`secondary-${id}`).checked, id).toBe(false);
    }
  });

  it("keeps the stat bar inside the track when a stat goes past the maximum", () => {
    pick("#primary", "colossus");
    pick("#secondary", "colossus");
    tick("sweet-shuckle-juice");
    tick("old-gateau");
    expect(shown()).toEqual([328, 275, 275, 285, 285, 285]);
    expect(fill(3)).toBe("100%");
  });
});

// Abilities that change a stat without any battle condition: Huge Power, Pure Power, Hustle and Wonder Guard.
// Plain stats for the 50-stat Pokémon at Lv 50 with 31 IVs are 125, 70, 70, 70, 70, 70.
describe("abilities that change a stat by themselves", () => {
  const abilityText = () => $("#result .ability")?.textContent;
  const passiveText = () => $("#result .passive")?.textContent;
  const choose = (value: string) => {
    const select = $("#ability") as HTMLSelectElement;
    select.value = value;
    select.dispatchEvent(new Event("change", { bubbles: true }));
  };

  beforeEach(() => {
    resetCalculator();
    pick("#primary", "safe");
    pick("#secondary", "brute");
    choose("0"); // the ability choice is kept while the secondary stays the same, so start from the first
  });

  it.each([["0", "Huge Power"], ["1", "Pure Power"]])("%s: %s doubles Atk in battle", (value, name) => {
    choose(value);
    expect(shown()).toEqual([125, 70, 70, 70, 70, 70]);
    expect(arrows()).toEqual([null, "→ 140", null, null, null, null]);
    expect(abilityText()).toBe(`Ability: ${name} (Atk ×2 in battle)`);
  });

  it("Wonder Guard (the hidden ability) leaves HP at 1, whatever else raises it", () => {
    choose("2");
    expect(shown()).toEqual([1, 70, 70, 70, 70, 70]);
    expect(abilityText()).toBe("Ability: Wonder Guard (Hidden) (max HP is 1)");
    setNumber("macho-brace", "50");
    setNumber("vitamin0", "31");
    expect(shown()[0]).toBe(1);
  });

  it("counts the primary's passive only once it is unlocked, and multiplies it with the ability", () => {
    pick("#primary", "brute"); // its passive is Hustle
    expect(arrows()[1]).toBe("→ 140");
    expect(passiveText()).toBeUndefined();
    tick("passive-unlocked");
    expect(arrows()[1]).toBe("→ 210"); // Huge Power ×2 and Hustle ×1.5 together
    expect(passiveText()).toBe("Passive: Hustle (Atk ×1.5 in battle)");
  });

  it("does not count a passive twice when it is the same ability as the fused ability", () => {
    pick("#primary", "echo"); // its passive is Huge Power
    pick("#secondary", "echo");
    tick("passive-unlocked");
    expect(arrows()[1]).toBe("→ 140");
    expect(abilityText()).toBe("Ability: Huge Power (Atk ×2 in battle)");
    expect(passiveText()).toBe("Passive: Huge Power"); // not counted, so no effect note
  });

  it("applies Wonder Guard from the passive too", () => {
    pick("#primary", "guardian");
    pick("#secondary", "safe");
    expect(shown()[0]).toBe(125);
    tick("passive-unlocked");
    expect(shown()[0]).toBe(1);
    expect(passiveText()).toBe("Passive: Wonder Guard (max HP is 1)");
  });

  it("says nothing extra for an ability that does not change a stat", () => {
    pick("#secondary", "safe");
    expect(abilityText()).toBe("Ability: Ability B");
    expect(arrows()).toEqual([null, null, null, null, null, null]);
  });
});

describe("best partner search", () => {
  const rows = () => [...document.querySelectorAll<HTMLElement>("#partner-body tr[tabindex]")];
  const rowNames = () => rows().map(r => r.querySelector(".pname")?.textContent);
  const choose = (id: string, value: string) => {
    const select = $(`#${id}`) as HTMLSelectElement;
    select.value = value;
    select.dispatchEvent(new Event("change", { bubbles: true }));
  };
  const hideMax = (on: boolean) => {
    const box = $("#rank-hidemax") as HTMLInputElement;
    box.checked = on;
    box.dispatchEvent(new Event("change", { bubbles: true }));
  };

  const hideSpecial = (on: boolean) => {
    const box = $("#rank-hidespecial") as HTMLInputElement;
    box.checked = on;
    box.dispatchEvent(new Event("change", { bubbles: true }));
  };

  const hideMega = (on: boolean) => {
    const box = $("#rank-hidemega") as HTMLInputElement;
    box.checked = on;
    box.dispatchEvent(new Event("change", { bubbles: true }));
  };

  beforeEach(() => {
    resetCalculator();
    pick("#primary", "safe");
    choose("rank-by", "total");
    choose("rank-type", "");
    hideMax(false);
    hideMega(false);
    hideSpecial(false);
  });

  it("lists at most ten partners, best total first", () => {
    expect(rows().length).toBe(10);
    expect(rowNames()[0]).toBe("Colossus");
  });

  it("ranks by the chosen stat and highlights its column", () => {
    choose("rank-by", "5");
    expect(rowNames()[0]).toBe("Colossus");
    expect(document.querySelectorAll("#partner-body th.hot").length).toBe(1);
    expect($("#partner-body th.hot")?.textContent).toBe("Spe");
  });

  it("hides Max forms and filters by the fused type", () => {
    expect(rowNames()).toContain("Gmax Mon");
    hideMax(true);
    expect(rowNames()).not.toContain("Gmax Mon");
    choose("rank-type", "Water");
    // Safe Mon is Water, so every fusion with it is Water
    expect(rows().length).toBeGreaterThan(0);
    choose("rank-type", "Dragon");
    expect($("#partner-body")?.textContent).toBe("No partners match these filters.");
  });

  it("hides Mega forms only when asked to", () => {
    expect(rowNames()).toContain("Mega Mon (Mega X)");
    hideMega(true);
    expect(rowNames()).not.toContain("Mega Mon (Mega X)");
    expect(rowNames()).toContain("Gmax Mon");
    hideMega(false);
    expect(rowNames()).toContain("Mega Mon (Mega X)");
  });

  it("hides special forms only when asked to", () => {
    expect(rowNames()).toContain("Odd Mon (Primal)");
    hideSpecial(true);
    expect(rowNames()).not.toContain("Odd Mon (Primal)");
    expect(rowNames()).toContain("Mega Mon (Mega X)");
    expect(rowNames()).toContain("Gmax Mon");
    hideSpecial(false);
    expect(rowNames()).toContain("Odd Mon (Primal)");
  });

  it("shows the same stats as the calculator for the same pair", () => {
    pick("#secondary", "colossus");
    const row = rows().find(r => r.querySelector(".pname")?.textContent === "Colossus");
    const cells = [...(row?.querySelectorAll("td") ?? [])].slice(3).map(c => Number((c.textContent ?? "").replace(/,/g, "")));
    expect(cells.slice(0, 6)).toEqual(shown());
    expect(cells[6]).toBe(shown().reduce((a, b) => a + b, 0));
  });

  it("follows the level and the held items", () => {
    const before = rows()[0]?.textContent;
    setNumber("level", "100");
    expect(rows()[0]?.textContent).not.toBe(before);
    const atLevel100 = rows()[0]?.textContent;
    setNumber("macho-brace", "50");
    expect(rows()[0]?.textContent).not.toBe(atLevel100);
  });

  it("uses a clicked row as the secondary Pokémon", () => {
    rows().find(r => r.querySelector(".pname")?.textContent === "Echo")?.click();
    expect($("#result .parents")?.textContent).toBe("Safe Mon + Echo");
    expect(($("#secondary") as HTMLInputElement).value).toBe("Echo");
  });

  it("links to the panel from the top and back again", () => {
    expect(($(".jump") as HTMLAnchorElement).getAttribute("href")).toBe("#partners");
    expect($("#partners")).not.toBeNull();
    expect(($("#partners .btn") as HTMLAnchorElement).getAttribute("href")).toBe("#top");
    expect($("#top")).not.toBeNull();
  });

  it("writes names as text, never as markup", () => {
    pick("#primary", "safe");
    expect($("#partner-body img")).toBeNull();
    expect($("#partner-body script")).toBeNull();
  });
});

describe("shareable links", () => {
  const query = () => new URLSearchParams(location.search);
  const load = (q: string) => {
    history.replaceState(null, "", `/?${q}`);
    window.dispatchEvent(new PopStateEvent("popstate"));
  };
  const value = (id: string) => ($(`#${id}`) as HTMLInputElement).value;
  const checked = (id: string) => ($(`#${id}`) as HTMLInputElement).checked;
  const note = () => $("#share-note") as HTMLElement;
  const ability = () => {
    const select = $("#ability") as HTMLSelectElement;
    return select.options[select.selectedIndex]?.textContent;
  };

  beforeEach(() => {
    resetCalculator();
    pick("#primary", "safe");
    pick("#secondary", "colossus");
    load("");
    window.dispatchEvent(new PopStateEvent("popstate"));
  });

  it("keeps the address bar in step with every setting", () => {
    setNumber("level", "77");
    expect(query().get("l")).toBe("77");
    pick("#nature", "jolly");
    expect(query().get("n")).toBe("Jolly");
    setNumber("iv3", "12");
    expect(query().get("iv")).toBe("31,31,31,12,31,31");
    tick("passive-unlocked");
    expect(query().get("pp")).toBe("1");
    setNumber("soul-dew", "4");
    setNumber("vitamin5", "9");
    tick("old-gateau");
    expect(query().get("pi")).toBe("sd4,v5-9,gateau");
    setNumber("secondary-macho-brace", "20");
    tick("secondary-eviolite");
    expect(query().get("si")).toBe("mb20,eviolite");
    expect(query().get("p")).toBe("Safe Mon");
    expect(query().get("s")).toBe("Colossus");
  });

  it("leaves out what is empty", () => {
    expect(query().has("pi")).toBe(false);
    expect(query().has("si")).toBe(false);
    expect(query().has("pp")).toBe(false);
    expect(query().has("ab")).toBe(false);
  });

  it("follows the picks, the swap and the best partner list", () => {
    ($("#swap") as HTMLButtonElement).click();
    expect([query().get("p"), query().get("s")]).toEqual(["Colossus", "Safe Mon"]);
    ($("#swap") as HTMLButtonElement).click();
    [...document.querySelectorAll<HTMLElement>("#partner-body tr[tabindex]")].find(r => r.querySelector(".pname")?.textContent === "Echo")?.click();
    expect(query().get("s")).toBe("Echo");
  });

  it("loads a full build from a link", () => {
    load("p=Ditto&s=Brute&l=63&n=Jolly&iv=31,20,10,31,5,31&ab=Wonder%20Guard&pp=1&pi=sd3,v1-5,sweet,gateau,metal-powder&si=mb50,foul,eviolite");
    expect(value("primary")).toBe("Ditto");
    expect(value("secondary")).toBe("Brute");
    expect(value("level")).toBe("63");
    expect(value("nature")).toContain("Jolly");
    expect([0, 1, 2, 3, 4, 5].map(i => value(`iv${i}`))).toEqual(["31", "20", "10", "31", "5", "31"]);
    expect(ability()).toBe("Wonder Guard (Hidden)");
    expect(checked("passive-unlocked")).toBe(true);
    expect(value("soul-dew")).toBe("3");
    expect(value("vitamin1")).toBe("5");
    expect(checked("sweet-shuckle-juice")).toBe(true);
    expect(checked("item-metal-powder")).toBe(true);
    expect(value("secondary-macho-brace")).toBe("50");
    expect(checked("secondary-foul-shuckle-juice")).toBe(true);
    expect(checked("secondary-eviolite")).toBe(true);
    expect(checked("old-gateau")).toBe(true);
    expect(checked("secondary-old-gateau")).toBe(false);
    expect(checked("eviolite")).toBe(false);
    expect(note().hidden).toBe(true);
    // The loaded build is written straight back unchanged.
    expect(query().get("pi")).toBe("sd3,v1-5,sweet,gateau,metal-powder");
    expect(query().get("ab")).toBe("Wonder Guard");
  });

  it("gives the same numbers whether a build is typed in or loaded from its link", () => {
    pick("#primary", "ditto");
    pick("#secondary", "brute");
    setNumber("level", "63");
    setNumber("iv2", "10");
    pick("#nature", "jolly");
    tick("passive-unlocked");
    setNumber("soul-dew", "3");
    setNumber("vitamin1", "5");
    tick("item-metal-powder");
    setNumber("secondary-macho-brace", "50");
    const typedIn = { stats: shown(), total: totalLine(), arrows: arrows(), link: location.search };
    resetCalculator();
    pick("#primary", "safe");
    pick("#secondary", "colossus");
    expect(shown()).not.toEqual(typedIn.stats);
    load(typedIn.link.slice(1));
    expect(shown()).toEqual(typedIn.stats);
    expect(totalLine()).toBe(typedIn.total);
    expect(arrows()).toEqual(typedIn.arrows);
    expect(location.search).toBe(typedIn.link);
  });

  it("matches names without regard to capitals", () => {
    load("p=safe mon&s=ECHO&n=jolly");
    expect(value("primary")).toBe("Safe Mon");
    expect(value("secondary")).toBe("Echo");
    expect(value("nature")).toContain("Jolly");
    expect(note().hidden).toBe(true);
  });

  it("writes only the finished build to the address bar while loading a link", () => {
    const spy = vi.spyOn(history, "replaceState");
    load("p=Ditto&s=Brute&ab=Pure%20Power&pi=metal-powder,v1-5");
    const written = spy.mock.calls.map(call => String(call[2])).filter(url => url.includes("?p="));
    spy.mockRestore();
    expect(written.length).toBeGreaterThan(0);
    for (const url of written) expect(url).toContain("ab=Pure%20Power");
  });

  it("returns to defaults for anything the link leaves out", () => {
    setNumber("soul-dew", "5");
    tick("passive-unlocked");
    load("p=Raichu&s=Echo");
    expect(value("soul-dew")).toBe("0");
    expect(checked("passive-unlocked")).toBe(false);
    expect(value("primary")).toBe("Raichu");
  });

  it("picks the first ability again when the link names none, even for the same secondary", () => {
    load("p=Safe Mon&s=Brute&ab=Pure%20Power");
    expect(ability()).toBe("Pure Power");
    load("p=Safe Mon&s=Brute");
    expect(ability()).toBe("Huge Power");
  });

  it("holds vitamins to the primary's IV and counts to their limits", () => {
    load("p=Safe Mon&s=Colossus&iv=31,5,31,31,31,31&pi=v1-20,mb999,sd99");
    expect(value("vitamin1")).toBe("5");
    expect(value("macho-brace")).toBe("50");
    expect(value("soul-dew")).toBe("10");
  });

  it("says what it could not use and keeps the rest", () => {
    load("p=Nobody&s=Echo&n=Grumpy&l=70&ab=Telepathy&pi=thick-club,sd2");
    expect(value("primary")).not.toBe("Nobody");
    expect(value("secondary")).toBe("Echo");
    expect(value("level")).toBe("70");
    expect(value("soul-dew")).toBe("2");
    expect(note().hidden).toBe(false);
    expect(note().textContent).toContain('primary "Nobody"');
    expect(note().textContent).toContain('nature "Grumpy"');
    expect(note().textContent).toContain('ability "Telepathy"');
    expect(note().textContent).toContain("thick-club for the primary Pokémon");
  });

  it("clears the note once a good link is loaded", () => {
    load("p=Nobody&s=Echo");
    expect(note().hidden).toBe(false);
    load("p=Raichu&s=Echo");
    expect(note().hidden).toBe(true);
  });

  it("ignores a damaged link and still shows a result", () => {
    load("p=%E0%A4%A&l=abc&iv=1,2&pi=%%%&zzz");
    expect($("#result h2")).not.toBeNull();
    expect(value("level")).toBe("50");
  });

  it("shows names from a link as text, never as markup", () => {
    load(`p=${encodeURIComponent('<img src=x onerror="alert(1)">')}&s=Echo`);
    expect(note().querySelector("img")).toBeNull();
    expect(note().textContent).toContain("<img src=x");
  });

  it("copies the link and says so", async () => {
    const writeText = vi.fn(async () => undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    setNumber("level", "91");
    const button = $("#copy-link") as HTMLButtonElement;
    button.click();
    await vi.waitFor(() => expect(button.textContent).toBe("Copied!"));
    expect(writeText).toHaveBeenCalledWith(location.href);
    expect(location.href).toContain("l=91");
    expect(note().hidden).toBe(true);
  });

  it("shows Copied! for two seconds", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    try {
      vi.stubGlobal("navigator", { clipboard: { writeText: async () => undefined } });
      const button = $("#copy-link") as HTMLButtonElement;
      button.click();
      await vi.advanceTimersByTimeAsync(0);
      expect(button.textContent).toBe("Copied!");
      await vi.advanceTimersByTimeAsync(1900);
      expect(button.textContent).toBe("Copied!");
      await vi.advanceTimersByTimeAsync(200);
      expect(button.textContent).toBe("Copy link");
    } finally {
      vi.useRealTimers();
    }
  });

  it("shows the link to copy by hand when the clipboard is not available", async () => {
    vi.stubGlobal("navigator", { clipboard: { writeText: async () => { throw new Error("denied"); } } });
    const button = $("#copy-link") as HTMLButtonElement;
    button.click();
    await vi.waitFor(() => expect(note().hidden).toBe(false));
    expect(note().textContent).toBe(`Copy this link: ${location.href}`);
    expect(button.textContent).toBe("Copy link");
  });

  it("does not disturb the jump links", () => {
    expect(($(".jump") as HTMLAnchorElement).getAttribute("href")).toBe("#partners");
    setNumber("level", "60");
    location.hash = "#partners";
    expect(location.search).toContain("l=60");
    setNumber("level", "61");
    expect(location.search).toContain("l=61");
    history.replaceState(null, "", location.pathname);
  });
});
