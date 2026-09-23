---
applyTo: "src/lib/ui/**/*.tsx"
---

# UI components

Presentational only. A component here renders what it is given and decides
nothing about GitHub, triage, or fetching.

- Must not import from `src/screens/`, `src/app/`, or `src/lib/github/`.
- Importing types from `src/lib/domain/types` is fine. Importing triage or
  review *logic* is not — compute in the screen and pass the result down.
- Nothing here may hold state that outlives a render except through props.

## Colour

Take a `Tone` prop and resolve it through `TONE` in `tone.ts`. Never write a hex
value or a `var(--...)` colour inline in a component.

If a design needs a colour that no tone provides, the question to answer first
is what it *means*. A new tone is a new meaning and should be rare; reaching for
one usually indicates the meaning already exists under another name.

`STATE_TONE` and `CONCLUSION_TONE` map domain values onto tones. Extend those
maps rather than branching on a triage state inside a component.

## Styling

Class names come from `src/styles/app.css`; tokens from
`src/styles/tokens.css`. Inline `style` is for tone-derived and data-derived
values only (a bar's colour, a fixed column width) — not for spacing, type, or
anything that belongs in a class.

Add a class to `app.css` rather than repeating the same inline object in two
places.

## Accessibility

- Real `<button>`, `<a href>`, `<input>` + `<label>`. Never `role` or `onClick`
  on a `div` or `span` — Tab skips it.
- Icon-only controls need `aria-label`. Decorative SVG needs
  `aria-hidden="true"`.
- Text meets 4.5:1 against its background. The values in `tokens.css` were
  chosen to clear that on `--panel`; a new colour needs checking.
- Status is never carried by colour alone. Every coloured dot or bar sits beside
  a label, a count, or an `aria-label` that says the same thing in words.
