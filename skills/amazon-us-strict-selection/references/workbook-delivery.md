# Workbook And Delivery Contract

Use this reference only with a compatible full-workflow project. The public userscript repository does not itself contain candidate normalization, image downloading, replay, workbook rendering, or acceptance implementations.

## Data Separation

- Build the final workbook only from final-qualified data.
- Build the rejected workbook only from rejected-audit data.
- Never place reject, review, history-skip, cache-skip, exception, or over-target rows in the final sheet.
- Require the final count to equal the requested target exactly before marking delivery complete.

## Presentation Contract

- Use Chinese for sheet names, headers, Chinese product name, strict conclusion, risk notes, and user-facing explanations.
- Preserve ASIN, Amazon link, original English title, source URLs, dates, prices, percentages, actual ASIN, batch name, queue hash, operator, and collection versions for audit.
- Place the embedded main image immediately to the right of ASIN.
- Keep dimensions/weight and price trend populated from source evidence. Do not ship hard-required fields as `N/A`.
- Do not estimate monthly revenue when it was not collected. Leave optional unsupported fields empty or `N/A` with an audit reason rather than inventing data.

Use the compatible project's authoritative workbook renderer. Do not recreate eligibility logic in spreadsheet formulas.

## Required Artifacts

- final-candidate workbook;
- rejected-audit workbook;
- final and focused previews;
- rejected-audit preview;
- workbook build report;
- acceptance report;
- source batch JSON, candidate JSON, and image directory.

## Machine Acceptance

Run the compatible project's acceptance checker. Require all checks to pass, including:

- target met exactly;
- final/rejected ASIN separation and final uniqueness;
- all final rows pass traffic, launch, dimensions, and price-trend rules;
- every final row has a local image;
- XLSX media and picture-shape counts equal final row count;
- all final ASINs appear in the final workbook;
- no rejected ASIN appears in the final workbook;
- formula error scan is empty.

## Visual Acceptance

Open or render the workbook preview and verify:

- images are visible offline and aligned with the correct ASIN;
- text is readable and not covered;
- filters and headers work;
- percentages, dates, and prices use intended formats;
- no row height, image, or long title breaks the table;
- only strict-qualified products appear on the main sheet.

Do not deliver when either machine or visual acceptance fails.
