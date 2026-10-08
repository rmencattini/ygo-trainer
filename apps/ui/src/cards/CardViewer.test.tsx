import { fireEvent, render, screen } from "@testing-library/react";
import { CardCatalog, type BaseCard } from "@ygo/cards";
import { describe, expect, it, vi } from "vitest";
import { CardViewer } from "./CardViewer";

const base = {
  alias: 0,
  type: 0x11,
  attribute: 16,
  race: 8192,
  def: 2500,
  desc: "Text.",
};
const cards: BaseCard[] = [
  {
    ...base,
    code: 89631139,
    name: "Blue-Eyes White Dragon",
    level: 8,
    atk: 3000,
  },
  {
    ...base,
    code: 46986414,
    name: "Dark Magician",
    level: 7,
    atk: 2500,
    def: 2100,
  },
];
const catalog = new CardCatalog(cards, {
  fr: {
    "89631139": { name: "Dragon Blanc aux Yeux Bleus", desc: "Ce dragon." },
  },
});
const images = { get: vi.fn(async () => new Uint8Array([1])) };

function setup() {
  globalThis.URL.createObjectURL = vi.fn(() => "blob:card");
  globalThis.URL.revokeObjectURL = vi.fn();
  render(<CardViewer catalog={catalog} images={images} />);
}

describe("CardViewer", () => {
  it("finds a card by name and shows it with its image", async () => {
    setup();
    fireEvent.change(screen.getByLabelText("Search cards"), {
      target: { value: "blue" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Blue-Eyes White Dragon" }),
    );
    expect(
      screen.getByRole("heading", { name: "Blue-Eyes White Dragon" }),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole("img", { name: "Blue-Eyes White Dragon" }),
    ).toHaveAttribute("src", "blob:card");
    expect(images.get).toHaveBeenCalledWith(89631139);
  });

  it("switches the selected card and the results to French", () => {
    setup();
    fireEvent.change(screen.getByLabelText("Search cards"), {
      target: { value: "blue" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Blue-Eyes White Dragon" }),
    );
    fireEvent.change(screen.getByLabelText("Card text language"), {
      target: { value: "fr" },
    });
    expect(
      screen.getByRole("heading", { name: "Dragon Blanc aux Yeux Bleus" }),
    ).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Search cards"), {
      target: { value: "dragon blanc" },
    });
    expect(
      screen.getByRole("button", { name: "Dragon Blanc aux Yeux Bleus" }),
    ).toBeInTheDocument();
  });

  it("offers only the languages the catalog has", () => {
    setup();
    const options = screen.getAllByRole("option").map((o) => o.textContent);
    expect(options).toEqual(["English", "French"]);
  });

  it("says when nothing matches", () => {
    setup();
    fireEvent.change(screen.getByLabelText("Search cards"), {
      target: { value: "zzz" },
    });
    expect(screen.getByText("No card matches “zzz”.")).toBeInTheDocument();
  });
});
