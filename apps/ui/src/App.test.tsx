import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "./App";

describe("App", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("shows the app title", () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise(() => {})),
    );
    render(<App />);
    expect(
      screen.getByRole("heading", { name: "YGO Trainer" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Loading cards…")).toBeInTheDocument();
  });

  it("tells you how to export card data when it is missing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("", { status: 404 })),
    );
    render(<App />);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "npm run cards:export",
    );
  });
});
