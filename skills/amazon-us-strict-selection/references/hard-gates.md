# Hard Gates And Data Integrity

## Safety Model

Optimize for zero false positives. A missing or uncertain value cannot satisfy a gate. Keep `review`, `skip`, `timeout`, `no_data`, and parser ambiguity outside the final table.

In full mode, the compatible project's configuration is authoritative at runtime. The approved baseline is also checked by `scripts/preflight.py` so unapproved drift cannot pass silently.

## A: Restricted, Compliance, And IP Risk

Apply this before price or demand checks. Use the compatible project's exclusions, product title, category, claims, brand, and available listing evidence.

Hard-exclude confirmed electrical/electronic, magnetic, chemical or efficacy consumables, fluids with chemical risk, candles, food or ingestibles, apparel/wearables/jewelry, dangerous materials, safety-sensitive products, and obvious licensed-character or IP-risk products according to the project rules.

Do not convert a hard exclusion into a warning because commercial metrics look attractive. A manual-review item cannot enter the final workbook until resolved and re-evaluated.

## B: Commercial Gate

Approved baseline:

- Current price: USD 9.90 through 50.00 inclusive.
- Rating: at least 4.0.
- Launch age: no more than 90 days.
- Variations: no more than 25.
- SellerSprite query preset: reviews no more than 100.
- Monthly child sales: 50-300 is the ranking preference; above 1500 is a hard rejection.

Keep the compatible project's hard-rule configuration unchanged unless the user explicitly authorizes a rules change. `reviewsTolerance=15` is a locked compatibility value in the documented baseline, not permission to widen the SellerSprite query or rewrite source values.

Do not use BSR, seller count, brand concentration, keyword concentration, seasonality, or visual similarity as hard exclusions unless the user separately changes the rules.

## C: Natural Traffic Gate

Require all of the following from current SellerSprite evidence:

- `status == ok`;
- no unresolved ASIN mismatch or redirect;
- `weeksRead >= 3`;
- latest natural share at least 70%;
- recent-four-week average natural share at least 70%;
- recent-four-week minimum natural share at least 70%.

Collector 0.4.6 may derive a 0% natural share only when current total traffic is explicitly greater than 0 and current natural traffic is the literal numeric value 0. Count that week as valid. Never derive from `--`, missing text, an ambiguous delta, or 0/0.

Any valid week below 70% is sufficient to reject early. Insufficient weeks remain non-passing even when available weeks look good.

## D: Dimensions Evidence

Require a nonempty, sourced combined dimensions/weight value. Do not fill a hard-required final field with `N/A`, guessed dimensions, or another variation's values.

## E: Price And Trend Gate

Require a current price within USD 9.90-50.00 and a nonempty price trend classified only as `stable` or `rising`. Reject `declining`, `volatile`, `no_data`, missing current price, or missing trend evidence.

## F: Image And Audit Integrity

Require a downloadable main image for the exact ASIN, preserve its source URL, convert it to a workbook-compatible file when needed, and embed it in Excel. Preserve source provenance for all audit fields.

Do not estimate monthly revenue, substitute parent sales for child sales, manufacture Chinese titles from unsupported facts, or hide missing data. Non-gate optional data may use `N/A` only with a reason in audit output.

## Final Release Rule

Only a row with a final `pass` after all A-F checks may enter final-candidate data and the final workbook. Put every other state in rejected/audit outputs.
