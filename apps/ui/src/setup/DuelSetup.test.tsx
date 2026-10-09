import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ImageSource } from "../cards/CardImage";
import type { DeckEntry } from "./deckLibrary";
import { DuelSetup } from "./DuelSetup";

const full = (code: number) => Array.from({ length: 40 }, () => code);
const library: DeckEntry[] = [
  {
    id: "presets/a.ydk",
    name: "Alpha",
    kind: "preset",
    deck: { main: full(1), extra: [5, 5], side: [6] },
    source: "https://ygoprodeck.com/deck/alpha-1",
  },
  {
    id: "presets/b.ydk",
    name: "Beta",
    kind: "preset",
    deck: { main: full(2), extra: [], side: [] },
  },
  {
    id: "test.ydk",
    name: "Test",
    kind: "test",
    deck: { main: [3], extra: [], side: [] },
  },
];
const known = (code: number) => code < 100;

const deck = (group: string, name: string) =>
  within(screen.getByRole("radiogroup", { name: group })).getByRole("radio", {
    name,
  });

function setup(importer = vi.fn(), images?: ImageSource) {
  const onStart = vi.fn();
  render(
    <DuelSetup
      library={library}
      images={images}
      known={known}
      onStart={onStart}
      importer={importer}
      storage={null}
    />,
  );
  return { onStart, importer };
}

describe("DuelSetup", () => {
  it("starts with you going first and the first preset on both sides", () => {
    const { onStart } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Start duel" }));
    expect(onStart).toHaveBeenCalledWith({
      goFirst: true,
      mine: library[0],
      theirs: library[0],
    });
  });

  it("lets you go second and pick both decks", () => {
    const { onStart } = setup();
    fireEvent.click(screen.getByLabelText("I go second"));
    fireEvent.click(deck("Your deck", "Beta (40)"));
    fireEvent.click(deck("Opponent's deck", "Test (1)"));
    fireEvent.click(screen.getByRole("button", { name: "Start duel" }));
    expect(onStart).toHaveBeenCalledWith({
      goFirst: false,
      mine: library[1],
      theirs: library[2],
    });
  });

  it("warns about decks with problems but still lets you start", () => {
    setup();
    fireEvent.click(deck("Opponent's deck", "Test (1)"));
    expect(
      screen.getByText("Main Deck has 1 cards (needs 40 to 60)"),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start duel" })).toBeEnabled();
  });

  it("imports a .ydk file and selects it as your deck", async () => {
    const importer = vi.fn(async () => ({
      name: "Mine",
      deck: { main: full(4), extra: [], side: [] },
    }));
    const { onStart } = setup(importer);
    const file = new File(["#main\n4\n"], "mine.ydk");
    fireEvent.change(screen.getByLabelText("Import a .ydk file"), {
      target: { files: [file] },
    });
    await waitFor(() => expect(deck("Your deck", "Mine (40)")).toBeChecked());
    expect(importer).toHaveBeenCalledWith("#main\n4\n", "mine.ydk");
    fireEvent.click(screen.getByRole("button", { name: "Start duel" }));
    expect(onStart.mock.calls[0][0].mine).toMatchObject({
      name: "Mine",
      kind: "imported",
    });
  });

  it("imports a deck link and shows import errors", async () => {
    const importer = vi.fn(async () => {
      throw new Error("No deck list found on that page");
    });
    setup(importer);
    fireEvent.change(screen.getByLabelText("Deck link"), {
      target: { value: "https://ygoprodeck.com/deck/x-1" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Import link" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No deck list found on that page",
    );
    expect(importer).toHaveBeenCalledWith("https://ygoprodeck.com/deck/x-1");
  });

  describe("Arena look", () => {
    it("shows every deck as a tile with its cover card", async () => {
      URL.createObjectURL = vi.fn(() => "blob:cover");
      URL.revokeObjectURL = vi.fn();
      const images = { get: vi.fn(async () => new Uint8Array([1])) };
      setup(vi.fn(), images);
      expect(deck("Your deck", "Alpha (40)")).toBeChecked();
      expect(deck("Opponent's deck", "Beta (40)")).not.toBeChecked();
      // The cover is the first card of the Main Deck.
      await waitFor(() => expect(images.get).toHaveBeenCalledWith(2));
      expect(images.get).toHaveBeenCalledWith(1);
    });

    it("shows the chosen deck's card counts and list source", () => {
      setup();
      const you = screen.getByRole("region", { name: "You" });
      expect(within(you).getByText("Main 40")).toBeInTheDocument();
      expect(within(you).getByText("Extra 2")).toBeInTheDocument();
      expect(within(you).getByText("Side 1")).toBeInTheDocument();
      expect(
        within(you).getByRole("link", { name: "List source" }),
      ).toHaveAttribute("href", "https://ygoprodeck.com/deck/alpha-1");
    });

    it("keeps the import tools folded until you open them", () => {
      setup();
      const details = screen.getByText("Import a deck").closest("details");
      expect(details).not.toHaveAttribute("open");
      expect(details).toContainElement(
        screen.getByLabelText("Import a .ydk file"),
      );
    });
  });
});
