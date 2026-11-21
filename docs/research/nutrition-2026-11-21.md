# Food-logging research log (nutrition data + optional AI)

Date of research: 2026-11-21. Scope: private two-person PWA, India, ₹0 recurring cost, manual logging from a local catalog first, AI optional.
No files under <workspace> were modified.

Tools and environment:

- Exa MCP (`web_search_exa`, `web_fetch_exa`) was available and was the main research tool. All web facts below were read through Exa from the URL given.
- WebFetch could not resolve `www.gov.uk` (blocked by this session's network policy), so it was not used further.
- Bash egress through the agent proxy is blocked (HTTP 403 on CONNECT) for nearly every data host: getkatori.com, gov.uk, fdc.nal.usda.gov, api.nal.usda.gov, openfoodfacts.org, nin.res.in, zenodo.org, kaggle.com, huggingface.co. Only GitHub, PyPI and npm worked. So:
  - INDB was cloned from GitHub (its official host).
  - The CoFID 2021 workbook came from a GitHub mirror. Its SHA-256 matches a fingerprint for the official file that a third party published independently (details in §2).
  - The Katori CSV was read through Exa fetch and written to disk as text (details in §2).
  - USDA records were queried live from the official FDC API (`api.nal.usda.gov`, `DEMO_KEY`) through Exa fetch. No bulk USDA zip was downloaded.
- Labels used below: **VERIFIED** means read on the primary or official source. **3rd-party** means reported by a secondary source only. **UNVERIFIED** means not confirmed.

---

## 0. Bottom line

| Question                        | Answer                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Can we bundle IFCT 2017 values? | **No, not without written permission from ICMR-NIN.** The book says no part may be "stored or reproduced in any electronic format for creating a product without the prior written permission".                                                                                                                                                                                                                                                                                                                                                                                                     |
| Can we bundle INDB?             | **No.** The repo has no licence. Its values derive from IFCT 2017/2004. The authors themselves removed their IFCT-derived file (NIN_fct.xlsx) in Nov 2024.                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| What we can ship today          | (1) **Katori Indian food nutrition dataset**: CC BY 4.0, 63 dishes / 128 rows, values computed only from USDA (CC0). (2) **UK CoFID 2021**: OGL v3.0, 2,887 foods. About 247 rows match South-Asian dish keywords such as bhaji, dahl, curry, subji, khichadi, chapati, paratha, biryani and paneer. This is a rough keyword count that also includes some UK-style curries. (3) **USDA FoodData Central**: CC0 (SR Legacy for staples such as banana, egg and curd; FNDDS for a few Indian dishes and portion weights). (4) **Open Food Facts**: ODbL, live barcode lookup only, with attribution. |
| Sample coverage                 | Katori covers 11 of 19 sample foods directly (rajma only as "rajma chawal"). Katori + CoFID + USDA covers 18 of 19. **Paneer bhurji** is the gap and has to be composed from a recipe (CoFID paneer, oil, onion, tomato). Masala chai is in Katori; CoFID tea is British-style with no sugar.                                                                                                                                                                                                                                                                                                       |
| AI primary                      | **Cloudflare Workers AI**: 10,000 Neurons/day free, a vision model is available, zero data retention, no training on customer content.                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| AI fallback                     | **Gemini API free tier** (`gemini-3.5-flash-lite`, 500 RPD per 3rd-party reports), opt-in only. Free-tier inputs are used to improve Google products and **human reviewers may read them**.                                                                                                                                                                                                                                                                                                                                                                                                         |

---

## 1. Indian food composition data and licensing

### 1.1 IFCT 2017 (ICMR-NIN): **VERIFIED, cannot bundle without permission**

- Verbatim front matter of the official PDF: "Copyright © 2017 by National Institute of Nutrition … The use and dissemination of the data in this book is encouraged. This publication can be reproduced for personal use with full acknowledgment of the source. However, no part of this publication can be stored or reproduced in any electronic format for creating a product without the prior written permission of the National Institute of Nutrition, Hyderabad." (https://www.nin.res.in/ebooks/IFCT2017.pdf, accessed 2026-11-21)
- Contact for permission, from the same page: nin@ap.nic.in, ifct2017@gmail.com, +91 40 27197334. The FAO listing shows IFCT 2017 as "Free access", static PDF plus mobile app (https://www.fao.org/food-composition/tables-and-databases/detail/(country--date)-title-9/en, accessed 2026-11-21). Free access is not a reuse licence.
- Content: 528 key foods (https://ifct2017.github.io/, accessed 2026-11-21). These are mostly raw ingredients, not cooked dishes.
- Third-party electronic copies exist: the `ifct2017` GitHub org and npm packages, which are AGPL-3.0 since 18 Apr 2025 and MIT before that (https://github.com/ifct2017/ifct2017/blob/master/README.md, accessed 2026-11-21), and a Kaggle copy (https://www.kaggle.com/datasets/gijoe707/ifct2017/data). **A code licence on a repository does not override NIN's copyright terms on the data.** Do not use these copies as a source.
- Other projects take different positions. Heathy reproduces IFCT values arguing they are "factual data" (https://heathy.org/sources/). Katori says IFCT's copyright "does not allow its values to be stored electronically in a product without written permission, so none of them are kept in our data" (https://getkatori.com/methodology). Both accessed 2026-11-21. We follow the conservative reading, which matches the explicit terms.
- **Recommendation:** use IFCT only by hand as a sanity check, for example to compare against our catalog values. Do not store its values. If Indian raw-ingredient values are wanted later, email NIN for written permission.

### 1.2 Indian Nutrient Databank (INDB): **VERIFIED, no licence, do not ship**

- Paper: Vijayakumar A, Dubasi HB, Awasthi A, Jaacks LM. "Development of an Indian Food Composition Database." _Current Developments in Nutrition_ 8(7):103790, published 2024-06-13, DOI 10.1016/j.cdnut.2024.103790. **The article** is CC BY 4.0 (https://pmc.ncbi.nlm.nih.gov/articles/PMC11277795/, accessed 2026-11-21). That licence covers the article. It does not automatically cover the GitHub data.
- Official host: https://github.com/lindsayjaacks/Indian-Nutrient-Databank-INDB- . The paper's data statement says "All analysis codes and files are publicly and freely available on GitHub". There is also a portal at https://www.anuvaad.org.in/indian-nutrient-databank/ ("open-access database"), operated by Anuvaad Solutions LLP, New Delhi, contact awasthi@anuvaad.org.in. Both accessed 2026-11-21.
- **Licence: none.** I checked the repo at commit `fbdb62b` (2025-04-08). There is no LICENSE file (raw URLs for LICENSE, LICENSE.md and LICENSE.txt all return 404), and neither the README nor the portal states a licence. "Open-access" with no licence means all rights reserved by default.
- Derivation from IFCT, from the paper: "The stage 1 database was primarily derived from the … IFCT from 2017, with gaps filled using the ICMR-NIN IFCT 2004 and nutrient databases from the United Kingdom and United States". 528 raw items came from IFCT 2017 and 369 from IFCT 2004. 144 ingredients came from UK CoFID and 54 from USDA.
- Repo history (git log in the clone): on 2024-11-15 the authors **deleted `NIN_fct.xlsx`** (897 IFCT-derived raw items). The README now says IFCT data "must be requested from the original source". This strongly suggests NIN's terms were enforced or respected.
- Legal implication for us: INDB recipe values are computed largely from IFCT values, which are NIN-restricted, and the authors grant no licence. So shipping INDB-derived numbers would need permission from **the authors and, to be safe, NIN**. One open-source project (krishnabhat/indian-food-nutrition-mcp) reached the same conclusion: "The INDB repository has no license, so we do not ship its data" (https://github.com/krishnabhat/indian-food-nutrition-mcp/blob/main/DATA_SOURCES.md, 3rd-party, accessed 2026-11-21).
- Format, from my inspection of `INDB.xlsx`: sheet "Nutrient Data" with **1,014 rows × 82 columns**. Columns include `food_code`, `food_name`, `primarysource`, then 39 nutrients per 100 g (`energy_kj`, `energy_kcal`, `carb_g`, `protein_g`, `fat_g`, `freesugar_g`, `fibre_g`, …, `vitc_mg`, `carotenoids_ug`), then `servings_unit` (text, for example "bowl" or "chapati") and the same 39 nutrients per serving (`unit_serving_*`). Grams per serving are not given directly. They can be derived as unit_serving_kcal / energy_kcal × 100. `recipes_servingsize.xlsx` has 1,014 rows with `no_of_servings`, `size_of_servings` and `servings_unit`.
- Recipe sources (README): 490 from _The Art & Science of Cooking_ (2007), 378 from _Basic Food Preparation_ (2011) and 148 from food blogs (`recipe_links.xlsx`). The recipe compositions themselves come from copyrighted cookbooks, which is another reason not to redistribute.
- Data quality problems I observed: boiled egg 45 kcal/100 g with a "1 egg ≈ 151 g" serving; plain khichdi 57 kcal/100 g with a 574 g serving; several cutlets and koftas at about 640–700 kcal/100 g and over 2,000 kcal per serving, which looks like all frying oil counted with no yield factor; plain dosa 381 kcal/100 g. The paper itself says yield factors were not applied.
- Kaggle re-uploads of INDB, such as https://www.kaggle.com/datasets/batthulavinay/indian-food-nutrition (blank licence, "sourced from Anuvaad INDB") and https://www.kaggle.com/datasets/abhinav099802/indian-nutrient-databank-indb (licence "Unknown"), accessed 2026-11-21, inherit the same problem.
- **Recommendation:** do not ship. It is useful only as a private reference list of dish names, for example to decide which recipes to compose ourselves from CoFID or USDA. If wanted, ask Anuvaad/Jaacks for explicit permission and also check the NIN angle.

### 1.3 "Katori" Indian food nutrition dataset: **VERIFIED, CC BY 4.0, shippable**

- Host: https://getkatori.com/data, by Shivam Verma (Katori, an iPhone app company). README at https://getkatori.com/katori-indian-food-dataset-README.txt. Both accessed 2026-11-21.
- Licence, verbatim: "The dataset, the calorie chart and the katori diagram are licensed CC BY 4.0: share and adapt them for any purpose, commercial included, as long as you credit them." Required credit line: `Data: Katori Indian food nutrition dataset, getkatori.com/data (CC BY 4.0)`.
- Provenance: "Every ingredient is valued from its own USDA FoodData Central record". IFCT is "use[d] only to cross-check … none of them are kept in our data" (https://getkatori.com/methodology, accessed 2026-11-21). The upstream data is therefore CC0, and the recipes are the author's own work. Licence chain is clean.
- Size: 63 dishes and 128 rows (home, restaurant or dhaba preparation), 19 columns. The page says version 2026.11.17 and the README says 2026.11.12. The dataset changes often, with 50 corrections logged so far.
- Not to be confused with **katori.fit**, a different free calorie-tracker product (https://katori.fit/, accessed 2026-11-21).
- Caveats: it is a single-author commercial site and young (pages from Aug–Nov 2026). Values are recipe estimates, not lab analyses. It has no sabzis, no dairy, no fruit and no eggs.

### 1.4 Other "open" Indian dish datasets (Kaggle, Hugging Face): mostly unusable

All accessed 2026-11-21.

| Dataset                                                                                                                                                       | Stated licence | Real provenance                                                                                                                                | Verdict                                                                        |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| thebarbellcrew "5000 Indian Foods Nutrition and Macro Dataset" (https://www.kaggle.com/datasets/thebarbellcrew/5000-indian-foods-nutrition-and-macro-dataset) | MIT            | "cross-referencing ICMR-NIN IFCT, USDA … Atwater audits". No per-row sources. Values look templated (e.g. phulka 260, chapati 297 kcal/100 g). | **Avoid.** It mixes IFCT and the provenance can't be checked.                  |
| shadab80k "Indian Food Nutrition & Calories" (https://www.kaggle.com/datasets/shadab80k/indian-food-nutrition-and-calories-dataset)                           | CC BY-SA 4.0   | "Verified … from authentic sources", unnamed                                                                                                   | **Avoid.** Unknown origin, and the licence may not be the uploader's to grant. |
| batthulavinay "Indian Food Nutritional Values Dataset (2025)"                                                                                                 | blank          | INDB copy                                                                                                                                      | Avoid (see 1.2)                                                                |
| abhinav099802 "Indian Nutrient Databank (INDB)"                                                                                                               | Unknown        | INDB copy (`Anuvaad_INDB_2024.11.xlsx`)                                                                                                        | Avoid                                                                          |
| bindudiva "South indian food dataset" (https://www.kaggle.com/datasets/bindudiva/south-indian-food-dataset)                                                   | Unknown        | unstated                                                                                                                                       | Avoid                                                                          |
| shibangibaidya "Ayurvedic Indian Food Nutrition Dataset"                                                                                                      | n/a            | Uploader says "synthetic dataset … numerical values … may not reflect real-world"                                                              | Avoid                                                                          |
| chandankr014 "Indian Cuisines" (https://www.kaggle.com/datasets/chandankr014/indian-cuisines)                                                                 | not checked    | unstated                                                                                                                                       | Avoid (UNVERIFIED)                                                             |
| akprodromou CoFID on Kaggle                                                                                                                                   | "Apache 2.0"   | Re-upload of UK CoFID                                                                                                                          | Incorrect relabel. Use the original under OGL instead (1.5).                   |

Pattern: Kaggle licence fields are set by the uploader and are frequently wrong for scraped or derived data.

### 1.5 UK CoFID 2021 (McCance & Widdowson): **VERIFIED, OGL v3.0, shippable, strong for Indian dishes**

- Official page: https://www.gov.uk/government/publications/composition-of-foods-integrated-dataset-cofid (Public Health England, last updated 19 Mar 2021; Excel 4.42 MB; user guide GW-2010), accessed 2026-11-21. The user guide ends "© Crown copyright 2021".
- Licence: the Quadram Institute FN-NBRI FAQ (the CoFID compilers) says "the data itself is subject to use under the Open Government Licence for Public Sector Information. The information can be freely used but the source of the information must be acknowledged" (https://fnnbri.quadram.ac.uk/help/, accessed 2026-11-21). The gov.uk footer ("All content is available under the Open Government Licence v3.0, except where otherwise stated") did not appear in my Exa extraction. Several 3rd parties quote it (e.g. https://signal-lab.qdt.ai/datasets/uk-cofid-composition-of-foods). **Status: VERIFIED via the compiler's FAQ; footer wording 3rd-party.**
- Attribution: "Contains public sector information licensed under the Open Government Licence v3.0." plus a link to https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/ and the citation "PHE (2021) McCance and Widdowson's The Composition of Foods Integrated Dataset 2021". OGL needs no share-alike.
- Caution: the separate Quadram searchable website and API is a different product and may carry different terms (3rd-party claim, https://rag-repo.org/source/cofid/). Use the gov.uk Excel only.
- Relevance: CoFID includes many Indian and South-Asian home recipes collected from UK dietary surveys, for example "Curry, bhindi subji, homemade" (6 samples), "Khichadi, with butter ghee", "Bhaji, cauliflower and potato", "Curry, red kidney bean, Punjabi", "Chapatis, made without fat", "Paratha, homemade", "Biryani, chicken, takeaway" (10 samples) and "Cheese, Paneer" (9 samples).

### 1.6 USDA FoodData Central: **VERIFIED, CC0**

From https://fdc.nal.usda.gov/api-guide, accessed 2026-11-21:

- Licence, verbatim: "USDA FoodData Central data are in the public domain and they are not copyrighted. They are published under CC0 1.0 Universal (CC0 1.0)". Citation requested but not required: "U.S. Department of Agriculture, Agricultural Research Service. FoodData Central, 2019. fdc.nal.usda.gov." They also ask to be notified of products that use the data.
- API key: "a data.gov API key must be incorporated into each API request". Keys found published online are deactivated, so **never ship the key in a PWA bundle**. Use a server-side proxy, or better, bake the data into the local catalog at build time.
- Rate limits: default **1,000 requests/hour per IP**; exceeding it blocks the key for 1 hour (HTTP 429). `DEMO_KEY` is limited to 30/hour and 50/day per IP.
- Endpoints: `/v1/food/{fdcId}`, `/v1/foods` (multiple IDs), `/v1/foods/list`, `/v1/foods/search`.

Bulk downloads (https://fdc.nal.usda.gov/download-datasets, accessed 2026-11-21):

| Data type        | Release         | Zipped                | Unzipped   |
| ---------------- | --------------- | --------------------- | ---------- |
| Foundation Foods | 10/2026         | JSON 681K / CSV 4.1M  | 9M / 35M   |
| SR Legacy        | 04/2018 (final) | JSON 12.3M / CSV 6.7M | 205M / 54M |
| FNDDS 2021-2023  | 10/2024         | JSON 3.7M / CSV 200M  | 64M / 1.6G |
| Branded          | 10/2026         | JSON 187M / CSV 432M  | 3G / 3G    |

For FNDDS, the JSON is the practical download. It includes `foodPortions` (household portion weights) and `inputFoods` (recipe).

Indian dishes in FNDDS 2021-2023, checked live on the official API (`/v1/foods`, energy per 100 g):

| FDC ID  | Description              | kcal/100 g                                                                    | Portions (gram weight)                                                       |
| ------- | ------------------------ | ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| 2707713 | Bread, chappatti or roti | 299 (fat 9.2 g; ingredient: commercially prepared frozen whole-wheat chapati) | small 6" 27 g, **medium 7" 40 g**, large 8" 52 g                             |
| 2707715 | Bread, paratha           | 326                                                                           | 70 g per paratha (3rd-party, caltrac.ai; not checked on API)                 |
| 2707427 | Dal                      | 145                                                                           | 1 cup 240 g (3rd-party)                                                      |
| 2708346 | Idli                     | 128 (US recipe: glutinous rice + split peas)                                  | **1 item 38 g**                                                              |
| 2708347 | Dosa, plain              | 210                                                                           | **small 35 g, medium 80 g, large 155 g**                                     |
| 2709129 | Dosa, with filling       | 184                                                                           | 267 g medium (3rd-party)                                                     |
| 2706538 | Biryani with chicken     | 104                                                                           | 1 cup 196 g (3rd-party). Katori's audit says the USDA recipe is 23 % potato. |
| 2708985 | Biryani with vegetables  | 109                                                                           | not checked                                                                  |
| 2707430 | Sambar, vegetable stew   | 86                                                                            | not checked                                                                  |

SR Legacy staples, checked live:

| FDC ID | Food                                               | kcal/100 g |
| ------ | -------------------------------------------------- | ---------- |
| 168878 | Rice, white, long-grain, regular, enriched, cooked | 130        |
| 171284 | Yogurt, plain, whole milk                          | 61         |
| 173424 | Egg, whole, cooked, hard-boiled                    | 155        |
| 173944 | Bananas, raw                                       | 89         |
| 171265 | Milk, whole, 3.25 %                                | 61         |
| 169655 | Sugars, granulated                                 | 387        |
| 168893 | Wheat flour, whole-grain                           | 340        |
| 172436 | Pigeon peas (red gram), mature seeds, raw          | 343        |

### 1.7 Open Food Facts (packaged foods): **VERIFIED**

Licence (https://world.openfoodfacts.org/data, accessed 2026-11-21):

- The database is under ODbL. Individual contents are under DbCL. Images are CC BY-SA and "may contain graphical elements subject to copyright".
- Obligations: attribute any public use ("Contains data from Open Food Facts, available under the Open Database License"). Share-alike applies to adapted databases that are publicly used. Keep a DRM-free version open if redistributing. OFF also asks for "prominent UI attribution" with links, use of bulk exports instead of API crawling, and sending user-added products back.

API (https://openfoodfacts.github.io/openfoodfacts-server/api/, accessed 2026-11-21):

- v3 (latest v3.6) is current. v2 is "Deprecated — still supported".
- Custom User-Agent required, in the form `AppName/Version (ContactEmail)`. Reads need no other authentication.
- Rate limits: **15 req/min/IP for product reads** and **10 req/min/IP for search**. "Don't use it for a search-as-you-type feature." "If your requests come from your users directly (ex: mobile app), the rate limits apply per user." For more than a few hundred products, use the CSV/JSONL/Parquet exports. There are global limits that return 503. (Note: older guides quote 100/min for products; the current page says 15.)

Barcode endpoints:

- v3: `GET https://world.openfoodfacts.org/api/v3/product/{code}` with optional `fields=` (comma list; special values `none`, `raw`, `all`), `cc`, `lc`, `product_type` (https://openfoodfacts.github.io/documentation/docs/Product-Opener/v3/products/get-api-v3-product-code/, accessed 2026-11-21). The intro page example uses `/api/v3.6/product/3274080005003.json`.
- v2 (deprecated): `GET https://world.openfoodfacts.org/api/v2/product/{barcode}.json` (the .xml example is on the /data page).
- Staging for tests: `https://world.openfoodfacts.net` with basic auth `off:off`.

Indian coverage (3rd-party, all accessed 2026-11-21):

- An OFF community forum post, "Open Food Facts India Crosses 26,000 Products" (2026-11-11, contributor krishanti), reports 7,198 products with NOVA, 6,701 with Nutri-Score and 6000+ brands as of Oct 2026 (https://forum.openfoodfacts.org/t/open-food-facts-india-crosses-26-000-products/2454/1).
- The PackSense snapshot of 2026-11-03 lists 25,209 India products, of which **44.0 % have energy_kcal** and 87.3 % have a name (https://huggingface.co/datasets/PackSense/packsense-india).
- An independent analysis found India at 41.1 % "complete" (kcal + 3 macros) against 85–92 % for the US, Canada and Sweden (https://momentummenu.app/findings/somebody-has-to-type-it-in).
- I tried to get a live count from OFF's own search and facets API through Exa. It returned HTTP 503 (OFF's global rate limit). **Direct count UNVERIFIED.**
- Practical takeaway: a barcode scan finds an Indian product reasonably often (Indian EAN prefix 890), but **about half of the hits will have no nutrition table**. The app needs a "type the label" fallback and optional contribution back to OFF.

### 1.8 Recommendation for topic 1

1. **Bundle into the local catalog:** Katori CSV (CC BY 4.0) as the first-choice Indian dish layer. CoFID 2021 (OGL) for sabzis, dals, khichdi, rajma, chole, paneer, dairy, egg and fruit. USDA SR Legacy / FNDDS (CC0) for staples, for portion weights, and as the ingredient base for composing our own recipes (paneer bhurji, masala chai variants, and so on).
2. **Runtime only:** Open Food Facts barcode lookup. Cache only scanned products and show ODbL attribution.
3. **Never bundle:** IFCT 2017, INDB, or Kaggle re-uploads.
4. **Attribution screen** (About/Settings):
   - "Data: Katori Indian food nutrition dataset, getkatori.com/data (CC BY 4.0)". Add a note that we changed it, e.g. "values re-formatted/merged", as CC BY 4.0 requires indicating changes.
   - "Contains public sector information licensed under the Open Government Licence v3.0." plus the CoFID citation.
   - "U.S. Department of Agriculture, Agricultural Research Service. FoodData Central. fdc.nal.usda.gov."
   - "Contains data from Open Food Facts, available under the Open Database License", with links.

Fallback if Katori disappears or changes licence: CC BY 4.0 is irrevocable for copies already obtained, so keep our copy and the README. CoFID plus our own USDA-based recipes can cover the same dishes.

Open uncertainties for topic 1:

- Whether NIN would grant permission for a private, non-distributed two-person app. Untested; an email would settle it.
- Whether "factual data" arguments make IFCT values free to use in India. This is a legal question and I did not research Indian case law. Treat as not permitted.
- The exact CoFID licence wording on the gov.uk page footer (see 1.5).

---

## 2. Downloaded data: files, structure, coverage

Root: `<scratch>/research-data/`. The files were treated as untrusted. Nothing in them was executed. Inspection used `python3 -I` with scripts kept in `<scratch>/scripts/`.

| Path                                                                                                 | Licence                | How obtained                                                                                                                                                                                                                                                                                                                                                                                                           | Size / SHA-256                                                                  |
| ---------------------------------------------------------------------------------------------------- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `<scratch>/research-data/katori/katori-indian-food-dataset.csv`                                      | CC BY 4.0              | Read from https://getkatori.com/katori-indian-food-dataset.csv through Exa fetch (the proxy blocked a direct download) and written as text. **Not byte-identical** to the original: LF line endings instead of CRLF, trailing spaces removed. Content checked: 128 data rows, 19 columns, 63 dishes, matching the README.                                                                                              | 26,924 B, `4c302b6f…0c1140`                                                     |
| `<scratch>/research-data/cofid/McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021.xlsx` | OGL v3.0               | gov.uk was blocked, so taken from the GitHub mirror `hugobellamy/food-data-benchmark` (`data/source/…2021..xlsx`). Its SHA-256 **matches** the fingerprint of the official CoFID 2021 file published independently by Liorno (https://liorno.com/en-gb/sources-and-credits/, `436e9445…e97d`). Size 4,629,542 B (4.415 MiB) matches gov.uk's "4.42 MB". Before shipping, re-download from gov.uk and compare the hash. | 4,629,542 B, `436e9445ef2adb2a75f3d7edd51302de3adad25385f9795fc94ba58bd030e97d` |
| `<scratch>/research-data/indb_UNLICENSED_reference_only/`                                            | **None (do not ship)** | `git clone` of the official repo at commit `fbdb62bec519c6e2468582a799fb47e194b42558` (2025-04-08). Kept for comparison only.                                                                                                                                                                                                                                                                                          | `INDB.xlsx` `65f91911…9ecf`                                                     |

Not downloaded: USDA bulk zips (fdc.nal.usda.gov was blocked by the proxy). Individual records were verified through the official API instead (§1.6). Next step is to download `FNDDS 2021-2023 (JSON)` (3.7 MB) and `SR Legacy (CSV)` (6.7 MB) from a network that allows it.

### 2.1 Katori CSV structure

- **Rows:** 128, one per dish per preparation (63 home, 56 restaurant, 9 dhaba). **Dishes:** 63.
- **Families:** Biryani, Breads, Chicken, Chole and beans, Dal, Drinks, Paneer, Rice, Snacks, South Indian, Sweets.
- **Columns:** `dish, slug, family, preparation, serving, serving_g, serving_ml, kcal, protein_g, carbs_g, fat_g, kcal_per_100g, protein_g_per_100g, carbs_g_per_100g, fat_g_per_100g, fdc_ids, confidence, updated, url`
- **Units and basis:**
  - Per serving: kcal, protein_g, carbs_g, fat_g.
  - Per 100 g "of the dish as served", i.e. **cooked**: kcal_per_100g and the other `_per_100g` columns.
  - `serving_g` is grams. `serving_ml` is filled only for drinks.
  - `fdc_ids` lists the USDA ingredient records in recipe order. Ingredient grams are not in the CSV; they are on each dish page.
- **Nutrients:** energy and 3 macros only. No fibre, sugar or sodium.
- **Katori basis** (methodology page): 1 katori = 150 ml. Dal or curry = 150 g per katori; rice = 120 g per katori.
- **Consistency check:** kcal/serving_g×100 matches kcal_per_100g within 1.5 kcal except 3 rows (kaju katli, jalebi restaurant, poppadom), all rounding effects on small servings.
- **Oddity to raise with the publisher:** FDC 170923, which the API resolves as "Spices, cumin seed", appears in nearly every recipe, including "Roti" (flour, water, 170923) and "Chai" (milk, water, sugar, 170923). It may be a mis-mapped salt ID. The kcal effect is likely small (cumin 375 kcal/100 g at about 1 g per recipe), but the recipe does not match the dish name. Also, no tea-leaf record is listed for Chai.

### 2.2 CoFID 2021 structure

- **Sheets:** `List of tables`, `1.1 Notes`, `1.2 Factors`, `1.3 Proximates`, `1.4 Inorganics`, `1.5 Vitamins`, `1.6 Vitamin Fractions`, `1.7`–`1.12` fatty acids (per 100 g FA and per 100 g food), `1.13 Phytosterols`, `1.14 Organic Acids`.
- **Proximates layout:** rows 1–3 are headers (name, code such as `KCALS`, unit). **2,887 foods** from row 4.
- **Proximates columns:** `Food Code, Food Name, Description, Group, Previous, Main data references, Footnote, Water (g), Total nitrogen (g), Protein (g), Fat (g), Carbohydrate (g), Energy (kcal) (kcal), Energy (kJ) (kJ), Starch (g), Oligosaccharide (g), Total sugars (g), …, NSP (g), AOAC fibre (g), fatty-acid totals, Cholesterol (mg)`
- **Basis:** per 100 g of food as described, so cooked where the name says "boiled" or "homemade" (per 100 ml for alcoholic drinks). "Tr" means trace and "N" means present but not quantified. Energy factors are 4/9/3.75 kcal per g with carbohydrate as monosaccharide equivalents, so values are not directly comparable to US "carb by difference" (user guide).
- **Rows join across sheets by `Food Code`.** No portion or serving weights.

### 2.3 Sample coverage table (kcal per 100 g; serving weights where the source gives them)

"K" = Katori (home preparation). "C" = CoFID 2021. "U" = USDA FDC. INDB is shown **for comparison only (not shippable)**.

| Sample food                | Katori (CC BY)                                                                   | CoFID 2021 (OGL)                                                                                      | USDA FDC (CC0)                             | INDB (reference only)           | Shippable coverage                                                                          |
| -------------------------- | -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------ | ------------------------------- | ------------------------------------------------------------------------------------------- |
| Roti / chapati             | **255**; 1 medium roti = 40 g (102 kcal)                                         | 11-459 Chapatis, made without fat **202**; 11-987 made with fat, retail 328                           | FNDDS 2707713 **299**; portions 27/40/52 g | ASC096 202; serving ≈36 g       | ✅ K, C, U                                                                                  |
| Plain paratha              | **314**; 1 plain paratha = 60 g (189 kcal)                                       | 11-1104 Paratha, homemade **333**                                                                     | FNDDS 2707715 326                          | ASC097 298; ≈56 g               | ✅ K, C, U                                                                                  |
| Dal tadka (or toor dal)    | Dal tadka **121**; toor dal 102; 1 katori = 150 g (181 / 153 kcal)               | No "tadka". 13-105 pigeon-pea dahl, boiled, no fat, 118; 15-762 masoor dahl curry, Punjabi, 141       | FNDDS 2707427 "Dal" 145                    | no plain dal tadka              | ✅ K (exact); C/U approximate                                                               |
| Rajma                      | only "Rajma chawal" plate 129 (1 katori rajma + 1 katori rice, 270 g)            | 15-146 Curry, red kidney bean, Punjabi **106**                                                        | not checked                                | ASC165 144; ≈120 g              | ✅ C. ⚠ K only as a combo plate.                                                            |
| Chole                      | Chana masala **158**; 1 katori = 150 g                                           | 15-108 Curry, chick pea, whole & tomato, Punjabi, veg oil **112** (15-107 with butter 107)            | not checked                                | ASC162 163                      | ✅ K, C                                                                                     |
| Poha                       | **193**; 1 plate = 140 g (270 kcal), confidence medium                           | none                                                                                                  | not checked                                | BFP044 295; BFP045 veg poha 181 | ✅ K only                                                                                   |
| Idli                       | **122**; 2 medium idli = 100 g (so 50 g each)                                    | none                                                                                                  | FNDDS 2708346 **128**; 1 item 38 g         | ASC144 138; ≈25 g               | ✅ K, U                                                                                     |
| Dosa (plain)               | **252**; 1 plain dosa = 54 g (136 kcal)                                          | none (only 15-513 dosa filling)                                                                       | FNDDS 2708347 **210**; 35/80/155 g         | BFP148 381; ≈36 g               | ✅ K, U                                                                                     |
| Paneer bhurji              | —                                                                                | none (12-495 Cheese, Paneer 328 as an ingredient)                                                     | not checked                                | none (only egg bhurji)          | ❌ **Gap.** Compose a recipe: paneer (C 12-495 or K's USDA paneer IDs), oil, onion, tomato. |
| Chicken biryani            | **164**; 1 plate = 300 g home (491 kcal), 400 g restaurant                       | 19-454 Biryani, chicken, takeaway **163** (10 samples)                                                | FNDDS 2706538 104 (US recipe with potato)  | none (mutton 191)               | ✅ K, C                                                                                     |
| Veg biryani                | **149**; 1 plate = 300 g (447 kcal)                                              | none (12-472 Pilau, vegetable 112)                                                                    | FNDDS 2708985 109                          | ASC123 175; ≈302 g              | ✅ K, U                                                                                     |
| Aloo gobi / other sabzi    | —                                                                                | 15-679 Bhaji, cauliflower and potato **106**; 15-783 Curry, potato, Punjabi 94; 15-628 Methi aloo 142 | —                                          | ASC171 Aloo gobhi 106; ≈176 g   | ✅ C only                                                                                   |
| Bhindi sabzi               | —                                                                                | 15-627 Curry, bhindi subji **71** (6 samples); 15-685 Bhaji, okra, Bangladeshi 97                     | —                                          | BFP269 111                      | ✅ C only                                                                                   |
| Khichdi                    | —                                                                                | 15-528 Khichadi, with butter ghee **169** (15-529 veg oil 169)                                        | —                                          | BFP144 57 (implausible)         | ✅ C only                                                                                   |
| Masala chai (milk + sugar) | Chai **49**; 1 cup 150 ml = 158 g (77 kcal); milk + sugar recipe, no tea-leaf ID | 17-168 Tea with whole milk 8 (British: 28 g milk per 225 ml, **no sugar**)                            | compose from 171265 milk + 169655 sugar    | ASC001 hot tea 16               | ✅ K. C is not equivalent.                                                                  |
| Plain cooked rice          | **130**; 1 katori = 120 g (156 kcal)                                             | 11-858 basmati, boiled **117**; 11-862 long-grain, boiled 131                                         | SR 168878 **130**                          | ASC113 117                      | ✅ K, C, U                                                                                  |
| Curd / dahi                | — (only as ingredient 171284)                                                    | 12-184 Yogurt, whole milk, plain **79**                                                               | SR 171284 **61**                           | none plain                      | ✅ C, U                                                                                     |
| Banana                     | —                                                                                | 14-318 Bananas, flesh only **81**                                                                     | SR 173944 **89**                           | —                               | ✅ C, U                                                                                     |
| Boiled egg                 | —                                                                                | 12-940 Eggs, chicken, whole, boiled **143**                                                           | SR 173424 **155**                          | ASC056 45 (implausible)         | ✅ C, U                                                                                     |

**Totals:** Katori alone covers 11/19 directly, plus rajma as a combo plate. Katori + CoFID + USDA covers **18/19**. Paneer bhurji is the only food that needs composing.

Spread between sources is large. Roti ranges 202–299 kcal/100 g, mostly from fat in the recipe; plain dosa ranges 210–381. So the catalog should **carry the source and recipe basis on each item**. Ideally offer "no-oil / home / restaurant" variants, which Katori already models.

### 2.4 Serving-size references for Indian household measures

| Measure                                                                         | Value                                                                                                                                                                                             | Source                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Status                                                                                                                       |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Katori sizes, ICMR-NIN Dietary Guidelines for Indians 2024, Annexure I (p. 111) | C6 large **360 ml**, C7 medium **200 ml**, C8 small **155 ml**, C9 small **115 ml**; tablespoon 15 g, teaspoon 5 g                                                                                | The official PDF's table of contents confirms "Annexure I Suggested measuring katori/cups and spoons" at p. 111 (https://nin.res.in/dietaryguidelines/pdfjs/locale/DGI_2024.pdf). The numbers come from secondary sources quoting Annexure I (https://hormoneindia.org/katori-measures, https://getkatori.com/what-is-a-katori, https://instacuppastore.com/blogs/main-page/ladle-size-guide-how-much-dal-one-karchhi-pours-and-why-yours-dribbles), all accessed 2026-11-21. | **Partially verified.** Annexure confirmed; numbers read from 3rd parties only. The PDF is too large to extract p. 111 here. |
| NIN diet-chart unit                                                             | "Measures: 1 cup/Katori = 200 ml". Raw cereal "75 g (3 roti or 1 katori poha)" and "100 g (2 katori rice / 3 roti or phulkas)", which implies about **25–33 g raw atta per roti**                 | ICMR-NIN diet chart, West India pregnancy (https://www.nin.res.in/downloads/6westindia.pdf), accessed 2026-11-21                                                                                                                                                                                                                                                                                                                                                              | VERIFIED on the official PDF (OCR text is garbled). Weights are **raw** ingredient weights.                                  |
| Roti, cooked weight                                                             | small 6" 27 g, **medium 7" 40 g**, large 8" 52 g                                                                                                                                                  | USDA FNDDS 2707713 `foodPortions` (official API)                                                                                                                                                                                                                                                                                                                                                                                                                              | VERIFIED                                                                                                                     |
| Roti / paratha / idli / dosa as Katori serves them                              | roti 40 g; plain paratha 60 g; idli 50 g each; plain dosa 54 g; poha plate 140 g; biryani plate 300 g home / 400 g restaurant; dal/curry katori 150 g; rice katori 120 g; chai cup 150 ml = 158 g | Katori CSV + methodology                                                                                                                                                                                                                                                                                                                                                                                                                                                      | VERIFIED (publisher's stated assumptions)                                                                                    |
| Idli, dosa                                                                      | idli 38 g; dosa 35 / 80 / 155 g                                                                                                                                                                   | USDA FNDDS 2708346, 2708347                                                                                                                                                                                                                                                                                                                                                                                                                                                   | VERIFIED                                                                                                                     |
| Ladle (karchhi)                                                                 | **No official standard found.** One 3rd party says DGI 2024 "publishes nothing for the ladle".                                                                                                    | instacuppastore.com (3rd-party)                                                                                                                                                                                                                                                                                                                                                                                                                                               | UNVERIFIED. Treat as a user-calibrated unit.                                                                                 |
| Plate / "half plate"                                                            | No official standard found. Katori uses 300 g (home) or 400 g (restaurant) for a biryani plate.                                                                                                   | —                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | UNVERIFIED. Make per-dish, user-editable.                                                                                    |

Suggestion: store each catalog item's serving units as `{label, grams}`, with defaults from Katori or FNDDS. Let each of the two users calibrate "my katori = X ml" once, as NIN and Katori both recommend.

### 2.5 Recommendation and fallback for topic 2

- **Recommendation:** build the local catalog by merging the Katori CSV (headline Indian dishes, with home/restaurant variants and serving weights) and CoFID proximates (sabzis, dals, khichdi, dairy, egg, fruit). Add USDA SR Legacy / FNDDS where needed. Keep `source`, `source_id`, `licence` and `basis` ("per 100 g as served") on every row.
- **Fallback:** if Katori is dropped, compose our own recipes from USDA ingredient records. FNDDS `inputFoods` and Katori's `fdc_ids` show the method.

Open uncertainties for topic 2:

- Katori CSV byte fidelity (rebuilt from an Exa text fetch). Re-download directly before shipping.
- CoFID file obtained via a mirror. The hash matches a third-party fingerprint; re-check against gov.uk.
- FNDDS portion weights for paratha, dal and biryani are 3rd-party only.
- USDA bulk files not downloaded in this session.

---

## 3. Optional AI with a genuinely free tier

Use cases: (a) turn "2 rotis, one katori dal tadka, half plate jeera rice" into `[{item_id, qty, unit}]` that matches our catalog; (b) identify dishes in a meal photo.

### 3.1 Google Gemini API (free tier)

All official pages below accessed 2026-11-21.

- **Available in India:** India is on the list at https://ai.google.dev/gemini-api/docs/available-regions. VERIFIED.
- **Free models**, marked "Free of charge" in the Free Tier column of https://ai.google.dev/gemini-api/docs/pricing:
  - `gemini-4-hydrogen`, `gemini-3.8-flash`, `gemini-3.6-flash`, `gemini-3.5-flash-lite` (input "text / image / video / audio"), `gemini-3.1-flash-lite`.
  - Also live and transcribe models.
  - Not on the free tier: Gemini 4 Carbon, Argon and Neon; 3.1 Pro Preview; Nano Banana image models.
  - VERIFIED.
- **Per-model free RPM/RPD:** **not published on the official docs.** The rate-limits page says limits "can be viewed in Google AI Studio", that they apply per project (not per key), and that RPD resets at midnight Pacific (https://ai.google.dev/gemini-api/docs/rate-limits). Third-party snapshots from Nov 2026 report:
  - Flash-Lite 3.5 and 3.1: 10–15 RPM, 250K TPM, **500 RPD**.
  - 3.8 Flash, 3.6 Flash and 4 Hydrogen: 5 RPM, 250K TPM, **20 RPD**.
  - Sources: https://www.scriptbyai.com/gemini-api-free-tier-limits/, https://github.com/Laeyoung/gem-back, https://dev.to/cynora/gemini-api-free-tier-429-per-minute-vs-per-day-limits-measured-on-four-models-mpc.
  - **UNVERIFIED officially.** Sources disagree on 10 vs 15 RPM.
- **Card required?** No, per the billing doc (https://ai.google.dev/gemini-api/docs/billing): "New accounts begin on the Free Tier". The Free tier qualification is "Active project or free trial; some projects need verification". The paid tier requires linking billing and prepaying at least $5. VERIFIED.
- **Data use, verbatim** from https://ai.google.dev/gemini-api/terms (effective March 23, 2026):

  > "When you use Unpaid Services, including, for example, Google AI Studio and the unpaid quota on Gemini API, Google uses the content you submit to the Services and any generated responses to provide, improve, and develop Google products and services and machine learning technologies, including Google's enterprise features, products, and services, consistent with our Privacy Policy.
  > To help with quality and improve our products, human reviewers may read, annotate, and process your API input and output. Google takes steps to protect your privacy as part of this process. This includes disconnecting this data from your Google Account, API key, and Cloud project before reviewers see or annotate it. Do not submit sensitive, confidential, or personal information to the Unpaid Services."

  The pricing page also says "Used to improve our products: Yes" for every free model. In the EEA, Switzerland and the UK, the paid-service data terms apply even to free use; that does not help India.

- **Other terms that matter** (same Terms page):
  - Users must be 18+, and the app must not be directed at under-18s.
  - "Use of Google AI Studio and Gemini API is for developers building with Google AI models for professional or business purposes, not for consumer use." It is a grey area whether a private household tool qualifies (see uncertainties).
  - "You may not use the Services in clinical practice, to provide medical advice …". Plain food logging should be fine; do not frame the output as medical or diet advice.

### 3.2 Cloudflare Workers AI

All accessed 2026-11-21.

- **Free allocation:** "a total of 10,000 Neurons per day at no charge" on both the Workers Free and Workers Paid plans. Resets 00:00 UTC. Usage beyond that needs Workers Paid at $0.011 per 1,000 Neurons (https://developers.cloudflare.com/workers-ai/platform/pricing/). VERIFIED. Some frontier models (kimi-k2.6, glm-5.x, deepseek-v4 and others) require a paid method.
- **Vision:** `@cf/meta/llama-3.2-11b-vision-instruct` is listed as "Vision: Yes, Zero data retention: Yes", priced at 4,410 neurons per M input tokens and 61,493 neurons per M output tokens. **Licence acceptance is required:** "you need to agree to the Meta License and Acceptable Use Policy … send an initial request … with `"prompt" : "agree"`" (https://developers.cloudflare.com/workers-ai/models/llama-3.2-11b-vision-instruct/). VERIFIED. Other candidates on the pricing list (`llama-4-scout-17b-16e-instruct`, `gemma-3-12b-it`, `mistral-small-3.1-24b-instruct`, `gemma-4-26b-a4b-it`) may be multimodal; their vision support is **UNVERIFIED** here.
- **Text models for parsing:** for example `@cf/meta/llama-3.3-70b-instruct-fp8-fast` (26,668 / 204,805 neurons per M in/out), `@cf/openai/gpt-oss-120b` (31,818 / 68,182), `@cf/meta/llama-3.1-8b-instruct-fp8-fast` (4,119 / 34,868).
- **Budget estimate** (my arithmetic, not a vendor figure):
  - Text parse of about 600 input + 250 output tokens: about 67 neurons on llama-3.3-70b (≈150 parses/day), about 36 on gpt-oss-120b (≈280/day), or about 11 on llama-3.1-8b.
  - Photo with an assumed ~1,800 input tokens + 300 output: about 26 neurons (≈380/day). **The image token count on Workers AI is UNVERIFIED.**
  - Either way this is comfortably enough for two people.
- **Data use**, verbatim (https://developers.cloudflare.com/workers-ai/platform/data-usage/):
  - "Zero data retention: Workers AI processes Customer Content only for as long as needed to provide the service."
  - "No training: Cloudflare does not use Customer Content processed by Workers AI to train AI models."
  - Exceptions: stateful features (AI Gateway logging/caching, R2 and similar) and legal obligations. Operational metadata is retained.
  - VERIFIED.
- **Card needed for the Workers Free plan:** UNVERIFIED.

### 3.3 Groq

All accessed 2026-11-21.

- Rate-limit table on https://console.groq.com/docs/rate-limits: `openai/gpt-oss-120b`, `openai/gpt-oss-20b` and `qwen/qwen3.8-27b` at **30 RPM, 1K RPD, 8K TPM, 200K TPD**. The page wording around the table is contradictory: it says the limits shown are "base limits for the Developer plan". The models page lists "Rate limits (Developer plan)" as 250K TPM / 1K RPM, so the lower table is **probably the free plan. UNVERIFIED which plan it is.**
- Vision: `qwen/qwen3.8-27b`, which is a **Preview** model ("evaluation purposes only … may be discontinued at short notice"). Each image counts as 2,048 input tokens; maximum 3 images and 20 MB per request (https://console.groq.com/docs/vision, https://console.groq.com/docs/models). With 8K TPM that is about 3 photos per minute.
- Data (https://console.groq.com/docs/your-data):
  - "By default, Groq does not retain customer data for inference requests."
  - It may log inputs and outputs for up to 30 days for reliability or abuse investigations.
  - **Zero Data Retention can be enabled by any customer** in Data Controls.
  - Data is stored in US GCP.
  - VERIFIED.
- Card requirement and free-plan availability in India: UNVERIFIED.

### 3.4 OpenRouter (free models)

All accessed 2026-11-21.

- `:free` models: **20 RPM**. **50 requests/day** if fewer than 10 credits have ever been purchased; **1,000/day** after buying at least 10 credits (a one-time ~$10, so not strictly ₹0). A negative balance blocks free models (https://openrouter.ai/docs/api_reference/limits, https://openrouter.ai/pricing). VERIFIED.
- Data: each provider has its own policy. There are account settings to allow or deny providers that may train on prompts, "separate settings for paid and free models". Some providers are listed as "May train" (e.g. DeepSeek, Liquid, NVIDIA) (https://openrouter.ai/docs/guides/privacy/logging). Free-model availability changes daily (3rd-party test logs).
- Verdict: usable for experiments. Privacy is unpredictable unless we pin a ZDR provider, and free endpoints often aren't ZDR (UNVERIFIED per model).

### 3.5 Recommendation

**Primary: Cloudflare Workers AI**

- Text parsing with `@cf/openai/gpt-oss-120b` or `@cf/meta/llama-3.3-70b-instruct-fp8-fast`, using JSON output constrained to our catalog IDs and units.
- Photo recognition with `@cf/meta/llama-3.2-11b-vision-instruct`, after the one-time `"agree"` request.

Reasons:

1. Contractual zero retention and no training. This is the best privacy of the four for meal photos and food diaries.
2. 10k Neurons/day free is enough for two users.
3. The API key stays server-side in a Worker, which also fits hosting the PWA free on Cloudflare.
4. No consumer-use restriction was found, though the Meta Llama licence and AUP apply.

Risk: accuracy of an 11B vision model on Indian thalis is unknown and was not benchmarked. Always show suggestions as editable picks from the local catalog.

**Fallback: Gemini API free tier, `gemini-3.5-flash-lite`**, about 500 RPD reported. It is multimodal and probably stronger on Indian dish recognition (not benchmarked). Use it **only behind an explicit per-feature opt-in**, because free-tier prompts and photos are used to improve Google products and may be read by human reviewers. Check the "professional or business purposes, not for consumer use" clause before relying on it.

Text-only alternative fallback: **Groq** with ZDR enabled (30 RPM / 1K RPD reported).

**Privacy disclosures to show users** (drafts):

- Cloudflare (default): "When you use 'Describe my meal' or 'Snap my plate', the text or photo is sent to Cloudflare Workers AI to suggest items. Cloudflare says it does not keep the content after answering and does not use it to train AI models. Suggestions are not saved anywhere until you confirm them in the app."
- Gemini (opt-in): "Optional: use Google Gemini for better photo recognition. Your photo or text is sent to Google under Gemini's free tier. Google may use it to improve its products, and **human reviewers may read it** (Google says it disconnects it from your account first). Don't use this for anything you consider private, and avoid photos with faces, documents or location details. [Enable] [Keep off]"
- General, in the About screen: "AI estimates can be wrong. Check every item before saving. Nothing here is medical advice."
- Also strip EXIF/GPS from photos before upload, and resize images (this also cuts token cost).

Open uncertainties for topic 3:

- Official per-model Gemini free limits (only visible in AI Studio).
- Whether Gemini's "not for consumer use" clause excludes a private two-person tool.
- The Workers AI image token accounting, and whether its other models accept images.
- Whether Groq's 30/1K/8K table is the free plan.
- Card requirements for the Cloudflare and Groq free plans.
- Real accuracy of any of these models on Indian dishes and portions. Run a 30-photo pilot before deciding.

---

## 4. Implementation notes for the catalog (non-binding)

- Suggested row schema: `id, name, aliases[] (Hindi/Hinglish), source (katori|cofid|usda|custom|off), source_id, licence, basis ("per_100g_as_served"), kcal, protein_g, carbs_g, fat_g, [fibre_g], servings[{label, grams}], variant (home|restaurant|dhaba|no-oil)`.
- Free-text parsing without AI: a local alias table plus a unit table (roti/piece, katori, plate, half plate, cup, glass, tbsp, tsp) handles "2 rotis, one katori dal tadka, half plate jeera rice" deterministically for common cases. Use AI only for what the parser can't resolve.
- Open Food Facts: call `GET /api/v3/product/{code}?fields=product_name,brands,nutriments,serving_size,quantity` on scan. Requests come from each user's device, so the 15/min limit applies per user. Cache only scanned items and show ODbL attribution.
  - Open question: browsers (Chromium) may ignore a custom `User-Agent` header. How OFF expects PWA clients to identify themselves is **UNVERIFIED**. Options are a tiny Worker proxy that sets the header, or asking OFF at reuse@openfoodfacts.org.
