import type { CardCatalog, ImageCache } from "@ygo/cards";
import { useEffect, useState } from "react";
import { CardViewer } from "./cards/CardViewer";
import { createImageCache } from "./cards/imageCache";
import { fetchCatalog } from "./cards/loadCatalog";
import "./App.css";

type Cards = { catalog: CardCatalog; images: ImageCache };

function App() {
  const [cards, setCards] = useState<Cards | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([fetchCatalog(), createImageCache()])
      .then(([catalog, images]) => setCards({ catalog, images }))
      .catch((e: Error) => setError(e.message));
  }, []);

  return (
    <main className="app">
      <h1>YGO Trainer</h1>
      <p>Practice turn-1 combos and handtrap situations.</p>
      {error && <p role="alert">{error}</p>}
      {!error && !cards && <p>Loading cards…</p>}
      {cards && <CardViewer catalog={cards.catalog} images={cards.images} />}
    </main>
  );
}

export default App;
