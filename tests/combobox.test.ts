// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { Combobox, normalize, type Choice } from "../src/ui/combobox.js";

const labels = ["Garchomp", "Garbodor", "Charizard", "Flabébé"];
const choices: Choice[] = labels.map(label => ({ label, text: normalize(label) }));

let input: HTMLInputElement;
let list: HTMLUListElement;
let onChange: Mock<() => void>;
let box: Combobox;

beforeEach(() => {
  document.body.innerHTML = '<input id="c"><ul id="c-list"></ul>';
  input = document.getElementById("c") as HTMLInputElement;
  list = document.getElementById("c-list") as HTMLUListElement;
  onChange = vi.fn<() => void>();
  box = new Combobox(input, list, onChange);
  box.setChoices(choices, 2); // Charizard
});

const focus = () => input.dispatchEvent(new Event("focus"));
const type = (value: string) => {
  input.value = value;
  input.dispatchEvent(new Event("input", { bubbles: true }));
};
const press = (key: string) => {
  const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true });
  input.dispatchEvent(event);
  return event;
};
const items = () => [...list.querySelectorAll("li")].map(li => li.textContent);
const active = () => list.querySelector(".active")?.textContent;
const isOpen = () => !list.hidden;

describe("Combobox: setup", () => {
  it("shows the chosen entry and starts closed", () => {
    expect(box.index).toBe(2);
    expect(input.value).toBe("Charizard");
    expect(isOpen()).toBe(false);
    expect(input.getAttribute("aria-expanded")).toBe("false");
  });

  it("has an index of -1 until choices are loaded", () => {
    document.body.innerHTML = '<input id="d"><ul id="d-list"></ul>';
    const empty = new Combobox(document.getElementById("d") as HTMLInputElement, document.getElementById("d-list") as HTMLUListElement, vi.fn<() => void>());
    expect(empty.index).toBe(-1);
  });

  it("setIndex changes the shown entry without calling onChange", () => {
    box.setIndex(0);
    expect(box.index).toBe(0);
    expect(input.value).toBe("Garchomp");
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe("Combobox: opening and filtering", () => {
  it("opens with the full list and the current choice highlighted", () => {
    focus();
    expect(isOpen()).toBe(true);
    expect(input.getAttribute("aria-expanded")).toBe("true");
    expect(items()).toEqual(labels);
    expect(active()).toBe("Charizard");
  });

  it("narrows the list as you type, matching anywhere in the name", () => {
    focus();
    type("bod");
    expect(items()).toEqual(["Garbodor"]);
  });

  it("ignores capitals and accents", () => {
    focus();
    type("FLABEBE");
    expect(items()).toEqual(["Flabébé"]);
  });

  it("highlights the first match while typing", () => {
    focus();
    type("gar");
    expect(items()).toEqual(["Garchomp", "Garbodor"]);
    expect(active()).toBe("Garchomp");
  });

  it("shows 'No matches' and Enter does nothing", () => {
    focus();
    type("zzz");
    expect(items()).toEqual(["No matches"]);
    press("Enter");
    expect(box.index).toBe(2);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("opens with ArrowDown when closed", () => {
    press("ArrowDown");
    expect(isOpen()).toBe(true);
  });
});

describe("Combobox: keyboard", () => {
  it("moves the highlight with ArrowDown and ArrowUp, stopping at the ends", () => {
    focus();
    press("ArrowDown");
    expect(active()).toBe("Flabébé");
    press("ArrowDown");
    expect(active()).toBe("Flabébé"); // last item: stays put
    for (let i = 0; i < 4; i++) press("ArrowUp");
    expect(active()).toBe("Garchomp"); // first item: stays put
  });

  it("points aria-activedescendant at the highlighted item", () => {
    focus();
    press("ArrowDown");
    const id = input.getAttribute("aria-activedescendant");
    expect(id).toBeTruthy();
    expect(document.getElementById(id as string)?.textContent).toBe("Flabébé");
  });

  it("Enter chooses the highlighted item, closes the list and calls onChange once", () => {
    focus();
    type("gar");
    press("ArrowDown"); // Garbodor
    press("Enter");
    expect(box.index).toBe(1);
    expect(input.value).toBe("Garbodor");
    expect(isOpen()).toBe(false);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("Escape closes and restores the previous choice without calling onChange", () => {
    focus();
    type("gar");
    press("Escape");
    expect(isOpen()).toBe(false);
    expect(input.value).toBe("Charizard");
    expect(box.index).toBe(2);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("leaving the box restores the previous choice", () => {
    focus();
    type("flab");
    input.dispatchEvent(new Event("blur"));
    expect(isOpen()).toBe(false);
    expect(input.value).toBe("Charizard");
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe("Combobox: mouse", () => {
  it("clicking an item chooses it", () => {
    focus();
    type("flab");
    list.querySelector("li")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(box.index).toBe(3);
    expect(input.value).toBe("Flabébé");
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("clicking 'No matches' does nothing", () => {
    focus();
    type("zzz");
    list.querySelector("li")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(box.index).toBe(2);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("keeps focus in the text box while the list is clicked", () => {
    focus();
    const event = new MouseEvent("mousedown", { bubbles: true, cancelable: true });
    list.querySelector("li")?.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });
});

describe("Combobox: safe text", () => {
  it("shows labels as plain text, never as HTML", () => {
    const hostile = '<b onclick="x()">bold</b> & <img src=x>';
    box.setChoices([{ label: hostile, text: normalize(hostile) }], 0);
    focus();
    const item = list.querySelector("li");
    expect(item?.textContent).toBe(hostile);
    expect(item?.children.length).toBe(0);
    expect(list.querySelector("b, img")).toBeNull();
    expect(input.value).toBe(hostile);
  });
});
