# Zadání: Náhoda v davu mizí (`0_cafe_mini_shift_LLN`)

| | |
|---|---|
| ID | `0_cafe_mini_shift_LLN` |
| Blok | C |
| Lokace | Park / Ulice u kavárny |
| Odpovídá | Ondra |
| Adresa (hlavní hra ji už zná) | https://0-cafe-mini-shift-lln.vercel.app |
| Navazuje | částečně na Náhoda za volantem (`0_cafe_mini_uncertainty`); po ní následuje Murphyho toast (`0_cafe_mini_LLN`) |

Jde o **grafické znázornění simulace**, není potřeba akční hra (na tu je Murphyho toast).
Např. posuvníkem zvyšovat počet aut (třeba na křižovatce).

## Text zadání (převzato z podkladů, `minihry.xlsx`)

**Zadání pro hráče:** Pojišťovna očekává, že nabourá zhruba každé desáté auto. Táhni posuvníkem
a přidávej auta. Dívej se, jak se skutečnost blíží tipu.

Posuvník má čtyři polohy. U každé se ukáže tip a skutečnost:

| Počet aut | Tip | Skutečnost | Komentář |
|---|---|---|---|
| 10 | 1 | 3 | Trojnásobek. Úplně vedle. Tady jsme měli smůlu, nabouralo hned tři. Jiná desítka aut by klidně měla nulu a další zas dvě. U tak malé skupiny to lítá nahoru dolů a nic z toho nepředvídáš. |
| 100 | 10 | 16 | Pořád vedle, ale už líp. |
| 1 000 | 100 | 108 | Skoro přesně. |
| 10 000 | 1 000 | 1 012 | Trefa. |

Byla by hezká simulace výše uvedeného.

**Zpětná vazba na konci** (dialog `0_cafe_dialog_uncle_afterLLN`, strýček):
„Vidíš to? U deseti aut je tip k ničemu, jednou máš tři škody, jindy nulu. U deseti tisíc sedí
skoro přesně pokaždé. Proto chce pojišťovna klientů co nejvíc, u velké skupiny se skoro nesplete.“

## Otevřené (doplní autor po dohodě s Pavlem)

- Pevná čísla z tabulky, nebo skutečná náhodná simulace (pak se „skutečnost“ při každém
  hraní liší)?
- Jak se počítá `successRate` (0–1). Hra nemá „správnou“ odpověď; možnost je `1` = dokončeno.
- Zda zpětná vazba strýčka patří do minihry, nebo ji zobrazí hlavní hra jako dialog.

Jak hru napojit na hlavní hru, otestovat a odevzdat: **Návod pro autory miniher** (pošle Pavel).
