import { describe, expect, it } from "vitest";
import { toLocaleTable } from "./cards-locale.mjs";

describe("toLocaleTable", () => {
  it("keeps id, name and text per card", () => {
    const api = {
      data: [
        {
          id: 89631139,
          name: "Dragon Blanc aux Yeux Bleus",
          desc: "Ce dragon.",
          name_en: "Blue-Eyes White Dragon",
        },
      ],
    };
    expect(toLocaleTable(api)).toEqual({
      89631139: { name: "Dragon Blanc aux Yeux Bleus", desc: "Ce dragon." },
    });
  });

  it("keeps the full text of pendulum cards and normalises line breaks", () => {
    const api = {
      data: [
        {
          id: 1,
          name: "P",
          desc: "[ Pendulum Effect ] \r\nÉchelle.\r\nMonstre.",
          pend_desc: "Échelle.",
        },
      ],
    };
    expect(toLocaleTable(api)[1].desc).toBe(
      "[ Pendulum Effect ]\nÉchelle.\nMonstre.",
    );
  });

  it("skips entries with no name", () => {
    expect(toLocaleTable({ data: [{ id: 2, desc: "x" }] })).toEqual({});
  });
});
