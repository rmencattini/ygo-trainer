import { render, screen } from "@testing-library/react";
import { CardCatalog } from "@ygo/cards";
import { describe, expect, it } from "vitest";
import { CardDetails } from "./CardDetails";

const catalog = new CardCatalog(
  [
    {
      code: 89631139,
      alias: 0,
      name: "Blue-Eyes White Dragon",
      desc: "This legendary dragon is a powerful engine of destruction.",
      type: 0x11,
      level: 8,
      attribute: 16,
      race: 8192,
      atk: 3000,
      def: 2500,
    },
  ],
  {
    fr: {
      "89631139": {
        name: "Dragon Blanc aux Yeux Bleus",
        desc: "Ce dragon légendaire.",
      },
    },
  },
);

describe("CardDetails", () => {
  it("shows the same card in English, then in French", () => {
    const { rerender } = render(
      <CardDetails catalog={catalog} code={89631139} lang="en" />,
    );
    expect(
      screen.getByRole("heading", { name: "Blue-Eyes White Dragon" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/powerful engine of destruction/),
    ).toBeInTheDocument();
    expect(screen.getByText("ATK 3000 / DEF 2500")).toBeInTheDocument();

    rerender(<CardDetails catalog={catalog} code={89631139} lang="fr" />);
    expect(
      screen.getByRole("heading", { name: "Dragon Blanc aux Yeux Bleus" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Ce dragon légendaire.")).toBeInTheDocument();
    expect(screen.getByText("ATK 3000 / DEF 2500")).toBeInTheDocument();
  });

  it("says when it falls back to English", () => {
    const empty = new CardCatalog(catalog.all(), {});
    render(<CardDetails catalog={empty} code={89631139} lang="fr" />);
    expect(
      screen.getByText("No French text yet, showing English."),
    ).toBeInTheDocument();
  });

  it("says when the card is unknown", () => {
    render(<CardDetails catalog={catalog} code={1} lang="en" />);
    expect(screen.getByText("Unknown card 1")).toBeInTheDocument();
  });
});
