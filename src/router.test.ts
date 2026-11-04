import { describe, expect, test } from "bun:test";
import { checklistHash, parseHash } from "./router";

describe("parseHash", () => {
  test("пустой hash открывает главный экран", () => {
    expect(parseHash("")).toEqual({ name: "home" });
    expect(parseHash("#")).toEqual({ name: "home" });
    expect(parseHash("#/")).toEqual({ name: "home" });
  });

  test("открывает чеклист", () => {
    expect(parseHash("#/checklist/abc")).toEqual({
      name: "checklist",
      id: "abc",
    });
  });

  test("декодирует id чеклиста", () => {
    expect(parseHash("#/checklist/a%20b")).toEqual({
      name: "checklist",
      id: "a b",
    });
  });

  test("неизвестный или битый маршрут открывает главный экран", () => {
    expect(parseHash("#/other")).toEqual({ name: "home" });
    expect(parseHash("#/checklist/")).toEqual({ name: "home" });
    expect(parseHash("#/checklist/%E0%A4%A")).toEqual({ name: "home" });
  });
});

describe("checklistHash", () => {
  test("кодирует id чеклиста", () => {
    expect(checklistHash("a b/c")).toBe("#/checklist/a%20b%2Fc");
  });
});
