# Náhoda za volantem (`0_cafe_mini_uncertainty`)

Minihra pro Aktuárskou kariérní hru, Level 0, blok C (Park / Ulice u kavárny). Verze 8.3: verze 7 po auditu zábavnosti,
playtestu, balancu a pojistné správnosti, doplněná o likvidátorský sprint, test barvy a srovnání deníku s 1 000 auty,
upravená podle závěrečné evaluace (balík D).

Hráč na parkovišti se 100 auty s povinným ručením zjistí, že konkrétní nehodu předpovědět nejde. Počet nehod za rok
odhadnout umí: před každým rokem zvolí tip a šířku pásma (úzké, střední, široké). Na stovce aut se vyplatí široké pásmo,
na tisíci autech úzké, takže zákon velkých čísel si vyzkouší na vlastních bodech. Výši škody odhaduje podle hlášení
o nehodě (místo, rychlost, zranění; barva auta je falešná stopa). V likvidátorském sprintu pak třídí hlášení do
přihrádek na čas o závod se strýčkem a z výsledku vznikne deník, podle kterého odhaduje rozložení škod.

Strýček hraje jako soupeř s lidskými chybami: u stovky aut tipuje jako loni (setrvačnost) a bere široké pásmo, u výše
škody čte hlášení dobře, ale u červených aut přidává polovinu a ve sprintu je posouvá o přihrádku výš (pověra),
u rozložení dává 5/4/1, ve finále vezme data
pojišťoven (35 na 1 000 aut), ale ze zbytečné opatrnosti střední pásmo. Ve sprintu jsou vždy dvě červená auta
s úplně jinou škodou (test barvy), takže pověru hráč uvidí na vlastních číslech. Hráč má navíc kartu **Likvidátor**
(1×): u jednoho hlášení ukáže odhad škody ±30 %, u hlášení se zraněním ±50 % (škoda na zdraví zůstává nejistá
i po prohlídce).

Navazuje minihra `0_cafe_mini_LLN` (Síla čísel). Délka asi 3,5 až 4 minuty.
Zadání, repliky a audit: dokumenty „Náhoda za volantem (0_cafe_mini_uncertainty)“ a „Audit minihry Náhoda za volantem“
v projektu Aktuárská hra.

## Pro hlavní hru (souhrn podle návodu pro autory)

| | |
|---|---|
| ID minihry | `0_cafe_mini_uncertainty` |
| `level` | nepoužívá se (jedna obtížnost), jakákoli hodnota i chybějící `level` se ignoruje |
| `payload` vstup | `demo` true / false (výchozí false), `seed` celé číslo 1 až 2147483647 (výchozí náhodně), `duel` true / false (výchozí true); vše nepovinné, neplatné hodnoty se nahradí výchozími |
| `successRate` | $\min(1;\ \max(0;\ \text{body}) / 50)$, body za odhady ve fázích 2, 3a, 3b, 3c a ve finále (nejvýš 66) |
| `payload` výstup | `{ version, skillPoints, duel, clover, f1, f2, f3a, sprint, f3c, finale, cards, decisions, durationSec }`, podrobně v kapitole Výstup |
| Protokol | verze 1, `src/minihra-protokol.ts` beze změn z návodu (2. 11. 2026) |
| Build | `npm run build`, výstup ve složce `dist` (Vite) |

## Průběh

| Část | Co hráč dělá | Rozhodnutí |
|---|---|---|
| 1. Které auto | 2 roky: označí 5 aut, po pátém se rok spustí sám | jen pro čtyřlístek, do bodů se nepočítá |
| 2. Kolik aut ze 100 | 3 roky: před každým rokem tip a šířka pásma, od 2. roku měkký časovač 8 s (plus doba na přečtení strýčkovy repliky, nejvýš 5 s) | 6 |
| 3a. Výše škody | 3 hlášení o nehodě, tip na logaritmickém posuvníku, karta Likvidátor | 3 + karta |
| 3b. Likvidátorský sprint | zkouška nanečisto, pak 8 hlášení; každé zatřídit do přihrádky podle 4 krátkých indicií, rychlost se počítá do bodů jako v Kahootu | 8 |
| 3c. Deník a rozložení | deník z 11 hlášení (3a a sprint), pak 3 kola: rozdělení 10 nehod do přihrádek, mezi koly lze změnit | 3 |
| Finále, 1 000 aut | 3 roky: tip a šířka pásma, k dispozici data pojišťoven (3,5 na 100 aut) | 6 |

## Vstupy

| | |
|---|---|
| `level` | nepoužívá se, minihra má jednu obtížnost; hodnota se ignoruje |
| `payload.demo` | `true` = pevná sekvence pro třídní demo (počty a škody ze zadání, pevné semínko), výchozí `false` |
| `payload.seed` | celé číslo 1 až 2147483647 pro opakovatelný průběh, výchozí náhodně |
| `payload.duel` | `false` vypne strýčka jako soupeře (a kartu Likvidátor), výchozí `true` |

Chybějící nebo neplatné hodnoty se nahradí výchozími. Minihra běží i bez `level` a bez `payload`.
Se semínkem je opakovatelné vše, co ovlivňuje body (počty, škody, barvy aut, odhad likvidátora).

Příklady pro tester: `{}`, `{"demo": true}`, `{"seed": 42, "duel": false}`. Ověřené okrajové případy: chybějící
`level` i `payload`, `level` jako text nebo `NaN`, `payload` jako text, pole nebo `null`, nesmyslné hodnoty
(`{"seed": -5, "duel": "x", "demo": "yes"}`), druhý `INIT` uprostřed hry (hra začne znovu od úvodu), trojité ťuknutí
na Pokračovat (odejde právě jeden `FINISH`).

## Bodování

**Počty (fáze 2 a finále).** Pásmo kolem tipu má poloviční šířku $\max(m, \lfloor r \cdot \text{tip} \rfloor)$ aut.

| Pásmo | $r$ | $m$ | V pásmu | Mimo | Příklad tip 4 | Příklad tip 35 |
|---|---|---|---|---|---|---|
| Úzké | 0,15 | 0 | +4 | −1 | přesně 4 | 30 až 40 |
| Střední | 0,30 | 1 | +2 | −1 | 3 až 5 | 25 až 45 |
| Široké | 0,75 | 2 | +1 | 0 | 1 až 7 | 9 až 61 |

Očekávané body za rok při tipu podle skutečné frekvence (simulace): 100 aut úzké −0,04, střední 0,64, **široké 0,95**;
1 000 aut **úzké 2,27**, střední 1,79, široké 1,00.

**Výše škody (fáze 3a).** Nejvýš 1,25krát víc nebo míň než skutečnost 3 body, nejvýš 1,5krát 2 body, nejvýš 2krát 1 bod.

**Likvidátorský sprint (fáze 3b), bodování jako v Kahootu.** Hlášení má jen 4 krátké indicie (kde, rychlost, co se
stalo, zranění) a barvu auta. Na každé hlášení je 9 s. Správná odpověď do 3 s dá 3 body, do 6 s 2 body, do 9 s 1 bod;
chyba i vypršený čas 0 bodů. Strýček se hodnotí stejně (odpovídá za 1,8 až 3,8 s, u červeného auta tipuje o přihrádku
výš).
Sprint začíná zkouškou nanečisto bez času a bez bodů. Správná přihrádka se určuje podle skutečné škody, takže i dokonalé
čtení hlášení trefí asi 94 % (jednotlivá škoda zůstává nejistá). Pravidlo férovosti: kdo zvolí přihrádku typickou pro
scénář hlášení, ale skutečná škoda padne jinam (asi 6 % hlášení), dostane 1 bod a vysvětlení „Podle hlášení správně,
tahle škoda ale vyšla jinak“; série správných odpovědí se nepřeruší. Platí i pro strýčka.

Test barvy: ve sprintu jsou červená vždy právě dvě auta, ťukanec s nejmenší škodou a nejdražší velká bouračka (když
ve sprintu žádná není, nejdražší bouračka). Strýček se na ťukanci splete vždy, po sprintu se obě auta ukážou vedle sebe
(„Stejná barva, úplně jiná škoda“). Protože strýček ztratí v průměru asi 0,7 bodu, odpovídá o 0,2 s rychleji než
ve verzi 8.1; výhry hráčů tím zůstávají stejné.

Výhry nad strýčkem v simulaci 8 000 her (čtenář pomalý: odpověď asi za 4 s a 88 % správně, běžný: 2,6 s a 95 %,
rychlý: 1,6 s a 97 %; mimo sprint hrají jako učící se hráč, ve fázi 3c podle podílů pojišťoven 5/4/1): pomalý 59 %,
běžný 88 %, rychlý 95 %, naivní hráč 0,1 %. Cíl auditu 55 až 70 % splňuje jen pomalý čtenář, výhru určuje hlavně
rychlost čtení ve sprintu; rychlost strýčka nebo váhu rychlosti doladit podle časů z playtestu. Body ve sprintu: pomalý asi 15,
běžný 20, rychlý 22, strýček 16,5, náhodné rychlé ťukání asi 8.

**Rozložení (fáze 3c).** Shoda 10 z 10 3 body, 9 z 10 2 body, 8 z 10 1 bod. Deník ukazuje pod přihrádkami dva pruhy,
podíl na počtu nehod a podíl na penězích z 11 viděných hlášení, a strýček to shrne čísly (např. „Velké nehody jsou jen
2 z 11, ale stojí 67 % všech peněz.“). Fáze 3a obsahuje vždy jednu velkou nehodu, takže pointa vyjde v každé hře.
Deník ale velké škody nadhodnocuje (v průměru 15 % nehod a 51 % peněz proti 9 % a 42 % v celém rozdělení), proto
u přihrádek ve fázi 3c vidí hráč vedle počtů z deníku i podíly pojišťoven (48 / 43 / 9 %) a strýček řekne, že deník je
malý. Po finále se ukážou tři pruhy: deník, všechny nehody na 1 000 autech za 3 roky (asi 105 nehod) a data pojišťoven
(9 % nehod, 42 % peněz), s vysvětlením, že jedna velká nehoda byla v deníku schválně a na pár desítkách nehod podíl
pořád kolísá.

**Smůla ve finále.** Kdo tipne podle dat (35 ± 3) a pásmo mine, uslyší „Smůla. Tip podle dat byl dobrý…“ místo výtky.
Pod řádky finále je věta, že úzké pásmo s tipem podle dat vyjde na tisíci autech asi 2 roky ze 3 (přesně 66 %), na
stovce aut s tipem 4 jen asi 1 rok z 5 (19 %).

Fáze 1 se nepočítá (čistá náhoda), první trefa dává čtyřlístek. Skóre duelu = body za odhady. Při shodě rozhoduje menší
součet chyb tipů ve finále, pak ve fázi 2, pak ve fázi 3a.

**`successRate`** $= \min\left(1, \dfrac{\max(0, \text{body})}{50}\right)$. Nejvyšší možný součet je 66, ale 50 bodů
odpovídá zhruba 90. až 95. percentilu optimální a rychlé hry (podle strategie hráče). Simulace: naivní hráč průměr
0,25, pomalý čtenář 0,71, běžný 0,81, rychlý 0,86 (AUC naivní proti pomalému 0,998). Mapování na odměny je potřeba domluvit s hlavní hrou.

## Výstup

```json
{
  "version": 8,
  "skillPoints": { "points": 38, "ref": 50, "max": 66 },
  "duel": { "player": 38, "uncle": 33, "winner": "player", "tieBreak": null },
  "clover": 0,
  "f1": { "crashes": [4, 2], "hits": 0, "uncleHits": 0 },
  "f2": [{ "tip": 3, "band": "siroke", "crashes": 3, "points": 1, "uncleTip": 2, "uncleBand": "siroke", "unclePoints": 1 }],
  "f3a": [{ "scenario": "park-auto", "color": "červená", "tip": 11000, "actual": 14000, "points": 2, "uncleTip": 20000, "unclePoints": 2, "likvidator": false }],
  "sprint": {
    "items": [{ "scenario": "park-auto", "color": "červená", "actual": 15000, "bin": 0, "reportBin": 0, "answer": 0, "ms": 2313, "points": 3, "uncleAnswer": 1, "uncleMs": 2482, "unclePoints": 0 }],
    "points": 21, "unclePoints": 12, "colorTest": [2, 5]
  },
  "f3c": [{ "alloc": [5, 4, 1], "counts": [5, 5, 0], "overlap": 9, "points": 2, "uncleOverlap": 9, "unclePoints": 2 }],
  "finale": [{ "tip": 35, "band": "uzke", "crashes": 34, "points": 4, "uncleTip": 35, "uncleBand": "stredni", "unclePoints": 2, "bins": [12, 17, 5], "money": [215000, 1010000, 1240000] }],
  "cards": { "likvidator": { "used": true, "car": 1 } },
  "decisions": 27,
  "durationSec": 240
}
```

- `f2` a `finale` mají 3 položky (roky), `f3a` 3 položky (hlášení), `sprint.items` 8 položek, `f3c` 3 položky (kola).
- Ve sprintu je `bin` správná přihrádka podle skutečné škody (0 ťukanec, 1 bouračka, 2 velká bouračka), `reportBin`
  přihrádka typická pro scénář hlášení (zdroj bodu za smůlu), `answer` volba hráče (`null` = vypršel čas) a `ms` doba
  odpovědi.
- `sprint.colorTest` jsou indexy dvou červených aut v `sprint.items` (test barvy), `null`, pokud ve sprintu chybí ťukanec
  nebo dražší hlášení.
- `band` je `uzke`, `stredni` nebo `siroke`. `bins` jsou počty ťukanců, bouraček a velkých bouraček v daném roce,
  `money` součty jejich škod v Kč.
- `duel`, `cards` a strýčkovy hodnoty jsou `null`, když je strýček vypnutý (`payload.duel = false`).
- `winner` je `player`, `uncle` nebo `tie`; `tieBreak` říká, co rozhodlo remízu na body (`finale`, `f2`, `f3a`).
- `clover` = 1, pokud hráč ve fázi 1 trefil aspoň jedno nabourané auto (návrh: hlavní hra připíše čtyřlístek).
- Částky jsou v Kč, `crashes` jsou počty nabouraných aut za rok.
- `scenario` je ID hlášení (12 scénářů, 4 v každé přihrádce), seznam a typické škody jsou v `src/game/sim.ts`.

Při neočekávané chybě minihra pošle `ERROR` s kódem `INTERNAL`.

## Model

- Frekvence: binomické rozdělení $\mathrm{Bi}(100;\ 0{,}035)$ na parkoviště, $\mathrm{Bi}(1000;\ 0{,}035)$ ve finále, bez
  ořezu (ve fázi 1 aspoň 1 nehoda).
- Výše škody v deníku, ve fázi 3c a ve finále: lognormální, $\sigma = 1{,}2$, useknuto na 5 tis. až 2 mil. Kč,
  $\mu = 10{,}2512$, takže podmíněný průměr je 62 tis. Kč. Podíly přihrádek 48 / 43 / 9 %, velké škody nesou asi 42 %
  peněz.
- Fáze 3a a sprint: 12 scénářů s typickou škodou 7 až 320 tis. Kč, škoda = typická × lognormální šum $\sigma = 0{,}4$
  (useknuto na 5 až 500 tis. Kč). Ve fázi 3a vždy jeden scénář z každé přihrádky, ve sprintu typ podle podílů
  48 / 43 / 9 %. Deník z 11 hlášení proto obsahuje v průměru 15 % velkých nehod s 51 % peněz (simulace 20 000 her).
- Karta Likvidátor: odhad = skutečná škoda × lognormální šum, $\sigma = 0{,}12$ a rozpětí ±30 % u škod na vozidlech,
  $\sigma = 0{,}2$ a ±50 % u hlášení se zraněním (rozpětí obsahuje skutečnou škodu asi v 97 %, resp. 96 % případů).

## Vývoj

```bash
npm install
npm run dev        # http://localhost:5173/?payload={"demo":true}
npm run build      # výstup do dist (Vite), tak ho staví Vercel
```

Komunikace s hlavní hrou je v `src/minihra-protokol.ts` (protokol verze 1, beze změn z návodu pro autory).
Simulace, bodování a strýček jsou v `src/game/sim.ts`, vstupy v `src/game/config.ts`, finále (canvas)
v `src/game/finaleCanvas.ts`.

`VITE_STANDALONE_PREVIEW=1` je jen pro sdílený náhled mimo hlavní hru (minihra pak nečeká na `INIT` ani když běží v
cizím iframu). Ve Vercelu pro ostrou verzi se nenastavuje.

## Kontrolní seznam

- Ovládání prstem na výšku, šířka 360 až 430 px, bez vodorovného posouvání. Bez drag & drop.
- Tlačítka a ovládací prvky mají aspoň 44 px. Výjimka: auta na parkovišti 10 × 10 mají na šířce 360 px asi 32 px.
  Přesnost tu nevadí, protože každé auto má stejnou šanci, takže přeťuknutí nic nezkazí. Druhé ťuknutí výběr ruší.
- Během běhu roku se stránka uvnitř minihry sama posune, aby parkoviště nebo plocha finále byly vidět nad spodní lištou.
- Animace se řídí časem (CSS a `performance.now`), na 120 Hz displeji běží stejně rychle. Respektuje
  `prefers-reduced-motion`.
- Texty česky a genderově neutrálně (hráč), strýček mluví v mužském rodě.
- Písma jsou součástí projektu (Baloo 2, Nunito, sady latin a latin-ext včetně velkých písmen s diakritikou).
- Žádné přihlašování, klíče, `localStorage`, cookies, `alert()` ani zvuky. Grafika je kreslená v kódu (SVG, canvas).
- Hra má pevný konec: souhrn a tlačítko Pokračovat, které pošle právě jeden `FINISH`. V samostatném režimu se tlačítko
  Hrát znovu odemkne až po 1,2 s.
