# Food catalog sources

The built-in food catalog (`supabase/migrations/20261121000500_food_catalog.sql`) is generated from these files
by `node scripts/data/build-food-catalog.ts`. Licensing was checked on 2026-11-21
([research log](../../docs/research/nutrition-2026-11-21.md)).

| File                             | Source                                                                                                          | Licence                      | Required attribution                                                                  |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------- | ---------------------------- | ------------------------------------------------------------------------------------- |
| `katori-indian-food-dataset.csv` | Katori Indian food nutrition dataset, <https://getkatori.com/data> (values computed from USDA FoodData Central) | CC BY 4.0                    | "Data: Katori Indian food nutrition dataset, getkatori.com/data (CC BY 4.0)"          |
| `cofid-2021-selection.csv`       | 51 rows of McCance and Widdowson's Composition of Foods Integrated Dataset 2021 (UK Government)                 | Open Government Licence v3.0 | "Contains public sector information licensed under the Open Government Licence v3.0." |
| `cofid-curation.json`            | Our names, Indian aliases and serving sizes for the CoFID rows                                                  | (this project)               | —                                                                                     |

**Not used, on purpose:** IFCT 2017 (NIN-ICMR forbids electronic storage for products without written permission)
and INDB (no licence; derived from IFCT).

**Known caveat:** the Katori CSV was obtained as text through a web-reading tool because the build sandbox could not
download it directly. Every row passed a consistency check (per-serving kcal = per-100 g kcal × serving weight, and
4/4/9 macro energy within 10%). Re-download it from the official page and regenerate before relying on it widely.

**Serving sizes:** Katori rows carry Katori's own serving weights. CoFID rows use Katori's conventions (1 katori =
150 g curry/dal/sabzi, 120 g rice; roti 40 g; plain paratha 60 g), ICMR-NIN measures (cup 200 ml, tablespoon 15 g,
teaspoon 5 g), or are labelled "typical" (egg ~50 g, banana ~100 g edible) — users can always log in grams instead.

**Coverage of the PRD sample foods:**

| Food                                                                                    | In catalog                                                                    | Source                                           |
| --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------ |
| Roti / chapati, paratha, dal tadka, poha, idli, dosa, chicken & veg biryani, chai, rice | yes                                                                           | Katori                                           |
| Rajma, chole, aloo gobi, bhindi sabzi, khichdi, curd, banana, boiled egg                | yes                                                                           | CoFID 2021 (rajma also as Katori "Rajma chawal") |
| Paneer bhurji                                                                           | **no** — create a custom food (or log paneer + oil separately)                | —                                                |
| Packaged foods                                                                          | **no** — enter from the label as a custom food (barcode lookup not built yet) | —                                                |
