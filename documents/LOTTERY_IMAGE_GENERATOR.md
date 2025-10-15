# Lottery Image Generator

This document describes the implementation for generating a lottery card image by rendering a 6-digit number onto a template using HTML Canvas.

## Location
- Page: `src/app/(pages)/lottery-image-gen-test/page.jsx`
- Template asset: `public/assets/images/lottery-card-template.jpg`

## User Flow
1. User enters a 6-digit number in the input field.
2. The canvas draws the base template image and overlays the digits.
3. The user clicks "Download PNG" to save the final image as `lottery-<digits>.png`.

## Validation
- Input must be exactly 6 digits (`^[0-9]{6}$`).
- Non-digit input is stripped; input is limited to 6 characters.
- Download is disabled until the input is valid.

## Rendering Details
- Canvas size matches the template image intrinsic size.
- Font size is responsive: 8% of canvas width.
- Bold system font stack ensures a clear, legible number.
- Digits are centered horizontally with consistent spacing (30% of font size between digits).
- Vertical position is approximately the lower third (`70%` of canvas height), tweakable to match design.

## Accessibility & UX
- `aria-invalid` reflects validation state.
- Helper text explains the 6-digit requirement.
- Clear error messages for invalid input or image load failures.

## Extensibility
- Adjust `fontSize`, `digitSpacing`, and `y` to align with a new template.
- To support different templates, map route query params to alternate image assets.
- For multi-language or custom fonts, preload and switch the `ctx.font` family.

## Best Practices Considered
- Client-side rendering avoids server load for simple composition.
- Uses `crossOrigin = "anonymous"` on image for safe `toDataURL` export.
- Avoids `any` types by using idiomatic React without TypeScript in this page.
- Keeps logic minimal and encapsulated within the page component.

## Future Enhancements
- Add multiple style presets (font, color, position) selectable by the user.
- Allow batch generation by uploading a CSV of 6-digit numbers and zip the results.
- Add watermark or QR code overlay options.

