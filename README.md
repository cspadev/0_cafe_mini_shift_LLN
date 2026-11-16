# Náhoda v davu mizí (`0_cafe_mini_shift_LLN`)

Minihra pro Aktuárskou kariérní hru, Level 0, blok C (Park / Ulice u kavárny, Zastávka MHD). Ukazuje zákon velkých
čísel: posuvníkem hráč přidává auta (10, 100, 1 000, 10 000) a dívá se, jak se skutečný počet nehod blíží tipu
pojišťovny. Vznikla z části s 1 000 auty minihry `0_cafe_mini_uncertainty` (Náhoda za volantem), na kterou navazuje.

Pojišťovna očekává, že v každém kole nabourá zhruba každé desáté auto. U každé skupiny je tip daný (10 aut: 1 nehoda,
100 aut: 10, 1 000 aut: 100, 10 000 aut: 1 000) a hráč volí, jak moc mu věří: úzké, střední, nebo široké pásmo kolem tipu.
Pak proběhnou 3 kola. U deseti aut počet lítá nahoru dolů (0, 1, 3 nehody), u deseti tisíc sedí skoro přesně, takže
hráč zjistí na vlastních bodech, že u malé skupiny se vyplatí opatrnost a u velké úzké pásmo. Strýček hraje jako soupeř:
u 10 až 1 000 aut bere pro jistotu střední pásmo, úzké až u 10 000 aut.

Délka asi 1,5 až 2 minuty. Repliky strýčka vycházejí z podkladů (list `0_cafe_mini_shift_LLN` v přehledu miniher).

## Pro hlavní hru (souhrn podle návodu pro autory)

| | |
|---|---|
| ID minihry | `0_cafe_mini_shift_LLN` |
| `level` | nepoužívá se (jedna obtížnost), jakákoli hodnota i chybějící `level` se ignoruje |
| `payload` vstup | `seed` celé číslo 1 až 2147483647 (výchozí náhodně), `duel` true / false (výchozí true); vše nepovinné, neplatné hodnoty se nahradí výchozími |
| `successRate` | úspěšnost volby pásem bez vlivu náhody, 0 až 1 (kapitola Bodování) |
| `payload` výstup | `{ version, choiceScore, bestBands, skillPoints, duel, groups, decisions, durationSec }`, podrobně v kapitole Výstup |
| Protokol | verze 1, `src/minihra-protokol.ts` beze změn z návodu (2. 11. 2026) |
| Build | `npm run build`, výstup ve složce `dist` (Vite) |

## Průběh

| Část | Co hráč dělá | Rozhodnutí |
|---|---|---|
| Úvod | strýček: „Pojišťovna očekává, že nabourá zhruba každé desáté auto. Táhni posuvníkem a přidávej auta. Dívej se, jak se skutečnost blíží tipu.“ | |
| 10 aut | pásmo kolem tipu 1, pak 3 kola; strýček prozradí své střední pásmo | 1 |
| 100 aut | posuvník (nebo tlačítko Přidat auta) na 100, pásmo kolem tipu 10, 3 kola | 1 |
| 1 000 aut | pásmo kolem tipu 100, 3 kola | 1 |
| 10 000 aut | pásmo kolem tipu 1 000, 3 kola; strýček teprve tady bere úzké | 1 |
| Souhrn | body po skupinách, trychtýř odchylek (všech 12 kol), nejvýhodnější pásma, závěrečná replika strýčka, Pokračovat | |

Posuvníkem jde kdykoli zpět na hotovou skupinu (auta z posledního kola a výsledky všech tří kol), dopředu jen o jednu
skupinu. Auta se kreslí na canvas: u 10 a 100 aut auta shora, u 1 000 kroužky, u 10 000 tečky; nabouraná auta
se objevují v průběhu kola.

Repliky strýčka (podle podkladů):

- po 10 autech: „Úplně vedle. Vyšlo 3, 0 a 2, tip byl 1. U tak malé skupiny to lítá nahoru dolů a nic z toho
  nepředvídáš.“ (čísla podle skutečných kol; když náhodou všechna tři kola sedí, „Tentokrát to sedělo… jedna nehoda
  navíc je hned dvojnásobek.“),
- po 100, 1 000 a 10 000 autech podle největší odchylky: „Úplně vedle.“ (100 % a víc), „Pořád vedle, ale už líp.“
  (15 až 100 %), „Skoro přesně.“ (5 až 15 %), „Trefa.“ (pod 5 %), vždy s největší odchylkou v procentech,
- na konci: „Vidíš to? U deseti aut je tip k ničemu, jednou máš 3 škody, jindy nulu. U deseti tisíc sedí skoro přesně
  pokaždé. Proto chce pojišťovna klientů co nejvíc, u velké skupiny se skoro nesplete.“ (čísla z hráčových deseti aut).

## Vstupy

| | |
|---|---|
| `level` | nepoužívá se, minihra má jednu obtížnost; hodnota se ignoruje |
| `payload.seed` | celé číslo 1 až 2147483647 pro opakovatelný průběh, výchozí náhodně |
| `payload.duel` | `false` vypne strýčka jako soupeře, výchozí `true` |

Chybějící nebo neplatné hodnoty se nahradí výchozími. Minihra běží i bez `level` a bez `payload`.
Příklady pro tester: `{}`, `{"seed": 42}`, `{"seed": 42, "duel": false}`.

## Bodování

Pásmo kolem tipu má poloviční šířku $\max(m, \lfloor r \cdot \text{tip} \rfloor)$ aut (stejná pásma jako v Náhodě za
volantem). Body se počítají za každé ze 3 kol.

| Pásmo | $r$ | $m$ | V pásmu | Mimo | 10 aut (tip 1) | 100 aut (tip 10) | 1 000 aut (tip 100) | 10 000 aut (tip 1 000) |
|---|---|---|---|---|---|---|---|---|
| Úzké | 0,15 | 0 | +4 | −1 | přesně 1 | 9 až 11 | 85 až 115 | 850 až 1 150 |
| Střední | 0,30 | 1 | +2 | −1 | 0 až 2 | 7 až 13 | 70 až 130 | 700 až 1 300 |
| Široké | 0,75 | 2 | +1 | 0 | 0 až 3 | 3 až 17 | 25 až 175 | 250 až 1 750 |

Očekávané body za kolo (přesně z binomického rozdělení, $\mathrm{Bi}(n;\ 0{,}1)$):

| Skupina | Úzké | Střední | Široké | Nejvýhodnější |
|---|---|---|---|---|
| 10 aut | 0,94 | **1,79** | 0,99 | střední |
| 100 aut | 0,91 | **1,28** | 0,99 | střední |
| 1 000 aut | **3,49** | 2,00 | 1,00 | úzké |
| 10 000 aut | **4,00** | 2,00 | 1,00 | úzké |

Úzké pásmo trefí u 10 aut jen 39 % kol, u 100 aut 38 %, u 1 000 aut 90 % a u 10 000 aut prakticky vždy. Nejvyšší
možný součet je 48 bodů. Skóre duelu jsou body hráče a strýčka (stejný tip, liší se jen pásmo); při shodě je remíza.

**`successRate`** je úspěšnost volby pásem bez vlivu náhody:

$$\text{successRate} = \frac{\sum_g \mathrm{EV}_g(\text{zvolené pásmo}) - \sum_g \min_b \mathrm{EV}_g(b)}{\sum_g \max_b \mathrm{EV}_g(b) - \sum_g \min_b \mathrm{EV}_g(b)},$$

kde $\mathrm{EV}_g(b)$ jsou očekávané body za kolo z tabulky. Nejvýhodnější pásmo u všech skupin dá 1, vždy úzké 0,82,
opatrně široké, střední, úzké, úzké 0,88, vždy střední 0,48, náhodná volba v průměru 0,44, vždy široké 0,02.
Náhoda (kolik aut skutečně nabouralo) successRate neovlivní, ovlivní jen body a duel.

Výhry nad strýčkem (simulace 200 000 her na strategii):

| Strategie (10 / 100 / 1 000 / 10 000 aut) | Průměr bodů | Výhry | Remízy |
|---|---|---|---|
| Nejvýhodnější: střední, střední, úzké, úzké | 31,7 | 97 % | 0 % |
| Opatrně: široké, střední, úzké, úzké | 29,3 | 77 % | 1 % |
| Střední, úzké, úzké, úzké | 30,6 | 72 % | 13 % |
| Vždy úzké | 28,0 | 57 % | 0 % |
| Náhodná volba | 20,4 | 12 % | 6 % |
| Vždy střední | 21,2 | 0 % | 0 % |
| Strýček: střední, střední, střední, úzké | 27,2 | | |

## Výstup

```json
{
  "version": 1,
  "choiceScore": 1,
  "bestBands": 4,
  "skillPoints": { "points": 30, "max": 48 },
  "duel": { "player": 30, "uncle": 24, "winner": "player" },
  "groups": [
    { "cars": 10, "tip": 1, "band": "stredni", "bestBand": "stredni", "uncleBand": "stredni",
      "rounds": [{ "crashes": 3, "points": -1, "unclePoints": -1 }, { "crashes": 0, "points": 2, "unclePoints": 2 }, { "crashes": 2, "points": 2, "unclePoints": 2 }] }
  ],
  "decisions": 4,
  "durationSec": 95
}
```

- `groups` má 4 položky (10, 100, 1 000 a 10 000 aut), `rounds` vždy 3 položky.
- `band`, `bestBand` a `uncleBand` jsou `uzke`, `stredni` nebo `siroke`; `bestBand` je pásmo s nejvyššími
  očekávanými body, `bestBands` počet skupin, kde ho hráč zvolil.
- `choiceScore` je totéž číslo jako `successRate` (zaokrouhleno na 3 desetinná místa).
- `duel`, `uncleBand` a `unclePoints` jsou `null`, když je strýček vypnutý (`payload.duel = false`).
- `winner` je `player`, `uncle` nebo `tie`.

Při neočekávané chybě minihra pošle `ERROR` s kódem `INTERNAL`.

## Model

- Počet nehod ve skupině $n$ aut v jednom kole: $\mathrm{Bi}(n;\ 0{,}1)$, nabouraná auta se losují rovnoměrně bez opakování.
  Četnost 10 % je zjednodušení ze zadání („zhruba každé desáté auto“), aby tipy vyšly celé (1, 10, 100, 1 000);
  v povinném ručení je skutečná četnost asi 3,5 nehody na 100 aut za pojistné období (Náhoda za volantem).
- Relativní směrodatná odchylka počtu $\sqrt{(1-p)/(np)}$: 95 % u 10 aut, 30 % u 100 aut, 9,5 % u 1 000 aut a 3 %
  u 10 000 aut.
- Odchylka skutečnosti od tipu se ukazuje v procentech: $(\text{skutečnost} - \text{tip}) / \text{tip}$.

## Vývoj

```bash
npm install
npm run dev        # http://localhost:5173/?payload={"seed":42}
npm run build      # výstup do dist (Vite), tak ho staví Vercel
```

Komunikace s hlavní hrou je v `src/minihra-protokol.ts` (protokol verze 1, beze změn z návodu pro autory).
Simulace, pásma a body jsou v `src/game/sim.ts`, vstupy v `src/game/config.ts`, kreslení davu aut v
`src/game/crowd.ts`.

`VITE_STANDALONE_PREVIEW=1` je jen pro sdílený náhled mimo hlavní hru (minihra pak nečeká na `INIT` ani když běží v
cizím iframu). Ve Vercelu pro ostrou verzi se nenastavuje.

## Kontrolní seznam

- Ovládání prstem na výšku, šířka 360 až 430 px, bez vodorovného posouvání. Bez drag & drop (posuvník je nativní
  `input type="range"`, polohy jdou zvolit i ťuknutím na tlačítka 10 / 100 / 1 000 / 10 000).
- Všechna tlačítka a ovládací prvky mají aspoň 44 px.
- Animace se řídí časem (`performance.now`), na 120 Hz displeji běží stejně rychle. Respektuje
  `prefers-reduced-motion`, pauzy na přečtení výsledku se nezkracují.
- Texty česky a genderově neutrálně (hráč), strýček mluví v mužském rodě.
- Písma jsou součástí projektu (Baloo 2, Nunito, sady latin a latin-ext včetně velkých písmen s diakritikou).
- Žádné přihlašování, klíče, `localStorage`, cookies, `alert()` ani zvuky. Grafika je kreslená v kódu (SVG, canvas).
- Hra má pevný konec: souhrn a tlačítko Pokračovat, které pošle právě jeden `FINISH`. V samostatném režimu se tlačítko
  Hrát znovu odemkne až po 1,2 s.
