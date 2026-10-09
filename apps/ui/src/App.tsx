import type { CardCatalog, ImageCache } from "@ygo/cards";
import { useEffect, useState } from "react";
import { CardViewer } from "./cards/CardViewer";
import { DuelLauncher } from "./duel/DuelLauncher";
import { createImageCache } from "./cards/imageCache";
import { fetchCatalog } from "./cards/loadCatalog";
import "./App.css";

type Cards = { catalog: CardCatalog; images: ImageCache };

function App() {
  const [cards, setCards] = useState<Cards | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"duel" | "cards">("duel");

  useEffect(() => {
    Promise.all([fetchCatalog(), createImageCache()])
      .then(([catalog, images]) => setCards({ catalog, images }))
      .catch((e: Error) => setError(e.message));
  }, []);

  return (
    <main
      className={`app ${view === "duel" ? "app--wide" : ""}`}
      data-theme="arena"
    >
      <header className="app__bar">
        <h1>YGO Trainer</h1>
        <p className="app__tagline">
          Practice turn-1 combos and handtrap situations.
        </p>
        {cards && (
          <nav className="app__nav">
            <button
              type="button"
              aria-pressed={view === "duel"}
              onClick={() => setView("duel")}
            >
              Duel
            </button>
            <button
              type="button"
              aria-pressed={view === "cards"}
              onClick={() => setView("cards")}
            >
              Card viewer
            </button>
          </nav>
        )}
      </header>
      {error && <p role="alert">{error}</p>}
      {!error && !cards && <p>Loading cards…</p>}
      {cards &&
        (view === "duel" ? (
          <DuelLauncher catalog={cards.catalog} images={cards.images} />
        ) : (
          <CardViewer catalog={cards.catalog} images={cards.images} />
        ))}
    </main>
  );
}

export default App;
