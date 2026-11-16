// Vstupy od hlavní hry. Chybějící nebo neplatné hodnoty se nahradí výchozími.

export interface Config {
  /** Semínko náhody pro opakovatelný průběh, celé číslo 1 až 2147483647. Výchozí null = náhodně. */
  seed: number | null;
  /** Strýček hraje jako soupeř. Výchozí true. */
  duel: boolean;
}

export const DEFAULT_CONFIG: Config = { seed: null, duel: true };

// level se v této minihře nepoužívá (jedna obtížnost), proto se ignoruje.
export function parseConfig(_level: number | undefined, payload: unknown): Config {
  const p =
    payload !== null && typeof payload === 'object' && !Array.isArray(payload)
      ? (payload as Record<string, unknown>)
      : {};
  const seed =
    typeof p.seed === 'number' && Number.isInteger(p.seed) && p.seed >= 1 && p.seed <= 2147483647 ? p.seed : null;
  return {
    seed,
    duel: p.duel === false ? false : DEFAULT_CONFIG.duel,
  };
}
