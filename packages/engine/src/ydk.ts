export interface Deck {
  main: number[];
  extra: number[];
  side: number[];
}

/** Parses a `.ydk` deck file (EDOPro / YGOPro format). */
export function parseYdk(text: string): Deck {
  const deck: Deck = { main: [], extra: [], side: [] };
  let section: keyof Deck = "main";
  text.split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trim();
    if (line === "#main") section = "main";
    else if (line === "#extra") section = "extra";
    else if (line === "!side") section = "side";
    else if (line === "" || line.startsWith("#")) return;
    else if (/^\d+$/.test(line)) deck[section].push(Number(line));
    else throw new Error(`ydk line ${i + 1}: not a passcode: ${line}`);
  });
  return deck;
}
