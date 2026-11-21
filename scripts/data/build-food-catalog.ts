// Generates the catalog migration from the committed, openly licensed source files:
//   data/food-catalog/katori-indian-food-dataset.csv   (CC BY 4.0, getkatori.com/data)
//   data/food-catalog/cofid-2021-selection.csv          (OGL v3.0, UK CoFID 2021; see extract script)
//   data/food-catalog/cofid-curation.json               (our names, aliases and serving sizes)
// Usage: node scripts/data/build-food-catalog.ts > supabase/migrations/<timestamp>_food_catalog.sql
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const dataDir = fileURLToPath(new URL('../../data/food-catalog/', import.meta.url));
// Fixed namespace so catalog ids are identical in every environment (uuid v5 of "<source>:<ref>").
const NAMESPACE = 'b5f3b7e2-3c1d-4f59-9a51-7d0f2c8e4a10';

/** Minimal RFC 4180 parser (quoted fields, doubled quotes). The inputs are small and trusted. */
type CsvRow = Record<string, string>;

function parseCsv(text: string): CsvRow[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text.charAt(i);
    if (inQuotes) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') inQuotes = false;
      else field += char;
    } else if (char === '"') inQuotes = true;
    else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i += 1;
      row.push(field);
      if (row.some((cell) => cell !== '')) rows.push(row);
      row = [];
      field = '';
    } else field += char;
  }
  if (field !== '' || row.length > 0) rows.push([...row, field]);
  const [header = [], ...body] = rows;
  return body.map((cells) =>
    Object.fromEntries(header.map((key, index) => [key, cells[index] ?? ''])),
  );
}

const sql = (value: string | null | undefined): string =>
  value === null || value === undefined || value === '' ? 'null' : `'${value.replace(/'/g, "''")}'`;
const num = (value: string | number | null | undefined): string =>
  value === null || value === undefined || value === '' ? 'null' : String(Number(value));
const textArray = (values: readonly string[]): string =>
  `array[${values.map(sql).join(', ')}]::text[]`;

const KATORI_ALIASES: [RegExp, string[]][] = [
  [/^roti$/, ['chapati', 'phulka', 'chapathi', 'fulka']],
  [/dal|daal/, ['dal', 'daal', 'dhal']],
  [/^chai$/, ['tea', 'masala chai', 'chaai']],
  [/^rice$/, ['chawal', 'bhaat', 'plain rice', 'steamed rice']],
  [/chole|chana/, ['chole', 'chana', 'chickpea']],
  [/paneer/, ['cottage cheese', 'panir']],
  [/biryani/, ['biriyani', 'briyani']],
  [/paratha/, ['parantha']],
  [/dosa/, ['dosai']],
  [/^idli$/, ['idly']],
  [/^sambar$/, ['sambhar']],
  [/^pakora$/, ['pakoda', 'bhajji', 'bhaji']],
  [/^poppadom$/, ['papad', 'papadum']],
  [/^ladoo$/, ['laddu', 'laddoo']],
  [/naan/, ['nan']],
  [/^pani puri$/, ['golgappa', 'gol gappa', 'puchka']],
  [/^gajar halwa$/, ['gajar ka halwa', 'carrot halwa']],
  [/^butter chicken$/, ['murgh makhani']],
  [/^upma$/, ['uppittu']],
  [/^jeera rice$/, ['cumin rice']],
  [/^rasmalai$/, ['ras malai']],
  [/^poha$/, ['pohe', 'flattened rice']],
  [/^rajma chawal$/, ['rajma', 'rajma rice']],
];

const VARIANT_LABELS: Record<string, string> = {
  home: 'home-style',
  restaurant: 'restaurant',
  dhaba: 'dhaba',
};

function katoriAliases(dish: string): string[] {
  const key = dish.toLowerCase();
  return [
    ...new Set(
      KATORI_ALIASES.filter(([pattern]) => pattern.test(key)).flatMap(([, aliases]) => aliases),
    ),
  ];
}

interface CatalogFood {
  source: string;
  ref: string;
  name: string;
  variant: string | null;
  aliases: string[];
  basisUnit: 'g' | 'ml';
  kcal: string;
  protein: string;
  carbs: string;
  fat: string;
  servings: [string, string | number][];
}

interface CurationEntry {
  code: string;
  name: string;
  aliases: string[];
  basis?: 'g' | 'ml';
  servings: [string, number][];
}

const field = (row: CsvRow, key: string): string => row[key] ?? '';

const foods: CatalogFood[] = [];

for (const row of parseCsv(readFileSync(`${dataDir}katori-indian-food-dataset.csv`, 'utf8'))) {
  const isDrink = field(row, 'serving_g') === '' && field(row, 'serving_ml') !== '';
  const servingAmount = isDrink ? field(row, 'serving_ml') : field(row, 'serving_g');
  const preparation = field(row, 'preparation');
  foods.push({
    source: 'katori',
    ref: `${field(row, 'slug')}:${preparation}`,
    name: field(row, 'dish'),
    variant: VARIANT_LABELS[preparation] ?? preparation,
    aliases: katoriAliases(field(row, 'dish')),
    basisUnit: isDrink ? 'ml' : 'g',
    kcal: field(row, 'kcal_per_100g'),
    protein: field(row, 'protein_g_per_100g'),
    carbs: field(row, 'carbs_g_per_100g'),
    fat: field(row, 'fat_g_per_100g'),
    servings: servingAmount ? [[field(row, 'serving'), servingAmount]] : [],
  });
}

const cofidValues = new Map(
  parseCsv(readFileSync(`${dataDir}cofid-2021-selection.csv`, 'utf8')).map((row) => [
    field(row, 'code'),
    row,
  ]),
);
const curation = JSON.parse(readFileSync(`${dataDir}cofid-curation.json`, 'utf8')) as {
  foods: CurationEntry[];
};
for (const item of curation.foods) {
  const values = cofidValues.get(item.code);
  if (!values) throw new Error(`Missing CoFID values for ${item.code}`);
  foods.push({
    source: 'cofid-2021',
    ref: item.code,
    name: item.name,
    variant: null,
    aliases: item.aliases,
    basisUnit: item.basis ?? 'g',
    kcal: field(values, 'kcal_per_100g'),
    protein: field(values, 'protein_g_per_100g'),
    carbs: field(values, 'carbs_g_per_100g'),
    fat: field(values, 'fat_g_per_100g'),
    servings: item.servings,
  });
}

const id = (food: CatalogFood): string =>
  `extensions.uuid_generate_v5('${NAMESPACE}', ${sql(`${food.source}:${food.ref}`)})`;

const lines = [
  '-- GENERATED by scripts/data/build-food-catalog.ts from data/food-catalog/. Do not edit by hand.',
  '-- Values are per 100 g (per 100 ml for drinks, treating 100 g ≈ 100 ml) as eaten.',
  `-- ${foods.length} catalog foods. Sources and licences: see public.food_sources and docs/research.md.`,
  '',
  'insert into public.foods (id, source_id, source_ref, name, variant, aliases, basis_unit, basis_amount, kcal_per_basis, protein_g_per_basis, carbs_g_per_basis, fat_g_per_basis, provenance) values',
  foods
    .map(
      (food) =>
        `  (${id(food)}, ${sql(food.source)}, ${sql(food.ref)}, ${sql(food.name)}, ${sql(food.variant)}, ${textArray(food.aliases)}, ${sql(food.basisUnit)}, 100, ${num(food.kcal)}, ${num(food.protein)}, ${num(food.carbs)}, ${num(food.fat)}, 'derived')`,
    )
    .join(',\n') + ';',
  '',
  'insert into public.food_servings (food_id, label, amount, position) values',
  foods
    .flatMap((food) =>
      food.servings.map(
        ([label, amount], index) => `  (${id(food)}, ${sql(label)}, ${num(amount)}, ${index})`,
      ),
    )
    .join(',\n') + ';',
  '',
];
process.stdout.write(lines.join('\n'));
