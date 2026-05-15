# PFFT Cashflow Tool — Design Brainstorm

## Approach A — "Ledger Precision"
<response>
<text>
**Design Movement**: Swiss International Typographic Style meets Modern Fintech
**Core Principles**:
1. Data density without clutter — every pixel earns its place
2. Strict horizontal rhythm — rows breathe, columns align perfectly
3. Colour encodes meaning — each account has a distinct hue from a controlled palette
4. Numbers are the hero — typography serves the figures, not the other way around

**Color Philosophy**: Deep navy (#1A2744) as the primary surface, with a warm off-white (#F7F5F0) for content areas. Each of the 8 accounts gets a unique accent drawn from a muted jewel palette (teal, amber, sage, rose, slate, indigo, coral, gold). Negative balances render in a warm red; positive in the body colour.

**Layout Paradigm**: Full-width sticky header with account summary cards. Below, a horizontally scrollable 24-column table (one column per month). Left column is frozen with account names. No sidebar — the table IS the interface.

**Signature Elements**:
- Thin 1px rule separating each account row, with a 2px accent left-border in the account's colour
- Monospace font (JetBrains Mono) for all numbers; humanist sans (DM Sans) for labels
- Sticky "Year" divider columns that visually separate Year 1 from Year 2

**Interaction Philosophy**: Click any cell to edit. Tab to advance. Hover row highlights the full 24-month span. Click account name to collapse/expand that account's detail rows.

**Animation**: Subtle fade-in on load. Number counters animate when opening balances change. Scroll-linked sticky header compression.

**Typography System**: DM Sans 400/600 for UI labels; JetBrains Mono 400/500 for all numeric values. Size scale: 11px data cells, 13px labels, 16px section headers, 24px summary totals.
</text>
<probability>0.07</probability>
</response>

## Approach B — "Profit First Dashboard" ✅ SELECTED
<response>
<text>
**Design Movement**: Contemporary Financial Dashboard — clean, structured, confidence-inspiring
**Core Principles**:
1. Account cards as visual anchors — each account is a distinct, recognisable entity
2. The projection table is the centrepiece — wide, scrollable, always visible
3. Warm neutrals ground the interface — no cold corporate blues
4. Input and output are clearly separated — settings panel vs. projection view

**Color Philosophy**: Warm white (#FAFAF8) background with a rich charcoal (#1C1C1E) for text. Each Profit First account gets a carefully chosen accent: Income = Forest Green, BAS = Amber, Materials = Slate Blue, Profit = Gold, Owner's Pay = Teal, Tax = Rose, OpEx = Indigo. These colours appear as left-border accents and subtle row tints.

**Layout Paradigm**: Two-panel layout. Left: a collapsible settings/inputs panel (opening balances + PF percentages). Right: the full 24-month projection table with frozen first column. Top: a summary bar showing current total across all accounts.

**Signature Elements**:
- Account colour chips — small coloured squares beside each account name
- Year-divider column — a visually distinct separator between Month 12 and Month 13
- Running balance row — a bold "Total Cash" row at the bottom of the table

**Interaction Philosophy**: Inputs in the left panel drive live recalculation of the entire table. Editable monthly income cells in the table itself. Hover states on rows. Export to CSV button.

**Animation**: Smooth panel slide for settings. Number transitions when values change (spring easing). Scroll-fade on the table edges to hint at horizontal scrollability.

**Typography System**: Outfit (Google Fonts) 400/600/700 for all UI; tabular-nums variant for all financial figures. Clean, modern, not corporate.
</text>
<probability>0.08</probability>
</response>

## Approach C — "Tradie's Notebook"
<response>
<text>
**Design Movement**: Tactile Brutalism meets Practical Workbook
**Core Principles**:
1. Feels like a physical cashflow workbook — ruled lines, clear sections
2. Bold section headers act as dividers — no ambiguity about what you're looking at
3. High contrast — dark text on light, no guessing
4. Built for non-accountants — plain language labels, no jargon

**Color Philosophy**: Cream (#FFF8F0) background evoking paper. Section headers in a deep burnt orange (#C4501A). Account rows alternate between white and a very light warm grey. Accent colour is the burnt orange used sparingly for totals and CTAs.

**Layout Paradigm**: Single-page vertical scroll. Opening balances section at top (card grid). Then the full projection table below. No sidebar — everything stacked vertically with clear section breaks.

**Signature Elements**:
- Ruled horizontal lines between every row (like a ledger book)
- Bold uppercase section labels in burnt orange
- A "Year 1 Total" and "Year 2 Total" summary row at the end of each year

**Interaction Philosophy**: Straightforward — fill in the top, see the table update. No hidden panels. What you see is what you get.

**Animation**: Minimal. Only number transitions when values change.

**Typography System**: Lora (serif) for section headers; Inter for body and numbers. Gives the "workbook" feel without being old-fashioned.
</text>
<probability>0.05</probability>
</response>

---

## Selected: Approach B — "Profit First Dashboard"

Clean, structured, confidence-inspiring. Two-panel layout with warm neutrals, account-colour coding, and a live 24-month projection table.
