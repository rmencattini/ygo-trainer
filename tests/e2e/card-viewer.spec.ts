import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";

// French text comes from a fixture so the test never calls YGOProDeck.
const frFixture = readFileSync(
  join(
    import.meta.dirname,
    "..",
    "..",
    "packages",
    "cards",
    "test",
    "fixtures",
    "fr.json",
  ),
);
const pixel = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

test("look up a card and read it in English and French", async ({ page }) => {
  await page.route("**/cards/index.json", (route) =>
    route.fulfill({ json: { langs: ["fr"] } }),
  );
  await page.route("**/cards/fr.json", (route) =>
    route.fulfill({ body: frFixture, contentType: "application/json" }),
  );
  await page.route("**/ygo-images/**", (route) =>
    route.fulfill({ body: pixel, contentType: "image/png" }),
  );

  await page.goto("/");
  await page.getByRole("button", { name: "Card viewer" }).click();
  await page.getByLabel("Search cards").fill("blue-eyes white");
  await page
    .getByRole("button", { name: "Blue-Eyes White Dragon", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Blue-Eyes White Dragon" }),
  ).toBeVisible();
  await expect(page.getByText("ATK 3000 / DEF 2500")).toBeVisible();
  await expect(
    page.getByRole("img", { name: "Blue-Eyes White Dragon" }),
  ).toBeVisible();
  await page.screenshot({ path: "tests/e2e/artifacts/card-viewer-en.png" });

  await page.getByLabel("Card text language").selectOption("fr");
  await expect(
    page.getByRole("heading", { name: "Dragon Blanc aux Yeux Bleus" }),
  ).toBeVisible();
  await page.screenshot({ path: "tests/e2e/artifacts/card-viewer-fr.png" });
});
