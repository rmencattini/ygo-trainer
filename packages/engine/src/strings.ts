export interface SystemStrings {
  system: Record<number, string>;
  victory: Record<number, string>;
  counter: Record<number, string>;
  setname: Record<number, string>;
}

/** Parses EDOPro's `strings.conf` (`!system 500 Select the card(s) to Tribute`). */
export function parseStringsConf(text: string): SystemStrings {
  const out: SystemStrings = {
    system: {},
    victory: {},
    counter: {},
    setname: {},
  };
  for (const line of text.split(/\r?\n/)) {
    const match = /^!(system|victory|counter|setname) (\S+) (.*)$/.exec(line);
    if (!match) continue;
    const id = Number(match[2]);
    if (Number.isFinite(id))
      out[match[1] as keyof SystemStrings][id] = match[3].trim();
  }
  return out;
}
