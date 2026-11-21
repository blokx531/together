"""Extracts the curated CoFID 2021 foods (data/food-catalog/cofid-curation.json) from the official
McCance and Widdowson's workbook into data/food-catalog/cofid-2021-selection.csv.

Usage: python3 -I scripts/data/extract-cofid-selection.py <path-to-CoFID-2021.xlsx>
Requires: openpyxl. The workbook is published by the UK government under the Open Government
Licence v3.0; only the selected rows are committed to this repository.
"""
import csv
import json
import sys
from pathlib import Path

import openpyxl

ROOT = Path(__file__).resolve().parents[2]
CURATION = ROOT / "data" / "food-catalog" / "cofid-curation.json"
OUTPUT = ROOT / "data" / "food-catalog" / "cofid-2021-selection.csv"

# Column positions in sheet "1.3 Proximates" (row 1 headers).
CODE, NAME, PROTEIN, FAT, CARBS, KCAL = 0, 1, 9, 10, 11, 12


def number(value):
    """CoFID uses 'Tr' for trace (treated as 0) and 'N' for not determined (left empty)."""
    if value in (None, "N", ""):
        return ""
    if value == "Tr":
        return "0"
    return str(float(value))


def main(workbook_path: str) -> None:
    wanted = {food["code"] for food in json.loads(CURATION.read_text())["foods"]}
    sheet = openpyxl.load_workbook(workbook_path, read_only=True, data_only=True)["1.3 Proximates"]
    found = {}
    for row in sheet.iter_rows(min_row=4, values_only=True):
        if row[CODE] in wanted:
            found[row[CODE]] = row
    missing = wanted - found.keys()
    if missing:
        raise SystemExit(f"Codes not found in workbook: {sorted(missing)}")
    with OUTPUT.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle)
        writer.writerow(["code", "cofid_name", "kcal_per_100g", "protein_g_per_100g", "carbs_g_per_100g", "fat_g_per_100g"])
        for code in sorted(found):
            row = found[code]
            writer.writerow([code, row[NAME], number(row[KCAL]), number(row[PROTEIN]), number(row[CARBS]), number(row[FAT])])
    print(f"Wrote {len(found)} foods to {OUTPUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main(sys.argv[1])
