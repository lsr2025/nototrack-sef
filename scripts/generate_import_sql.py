#!/usr/bin/env python3
"""
NotoTrack MS Forms Import SQL Generator
Reads SPAZA SHOP ASSESSMENT FORM(1-535).xlsx and outputs
SQL INSERT statements for public.assessments.

Usage:
    python3 scripts/generate_import_sql.py > scripts/step2_import_data.sql

Then paste/run step2_import_data.sql in the Supabase SQL editor.
"""

import zipfile
import re
import html
import sys
from datetime import datetime, timedelta

XLSX_PATH = (
    '/Users/administatror/Library/Mobile Documents/'
    'com~apple~CloudDocs/YamiMine/'
    'YMS x SEF x Ent Ilembe x Msinsi/notoTrack/'
    'SPAZA SHOP ASSESSMENT FORM(1-535).xlsx'
)

# Assigned to all imported records (created by step1_migration.sql)
IMPORT_AGENT_ID = 'aaaaaaaa-0000-0000-0000-000000000001'

# ── Helpers ───────────────────────────────────────────────────────────────────

def col_to_idx(col_str: str) -> int:
    """Excel column letter(s) → 0-based integer index."""
    result = 0
    for c in col_str:
        result = result * 26 + (ord(c) - ord('A') + 1)
    return result - 1


def excel_to_iso(serial: str):
    """Excel date serial number → ISO 8601 timestamp string."""
    try:
        f = float(serial)
        if f <= 0:
            return None
        d = datetime(1899, 12, 30) + timedelta(days=f)
        return d.isoformat()
    except Exception:
        return None


def yn(val: str) -> str:
    """'Yes' / 'No' → SQL TRUE / FALSE / NULL."""
    v = (val or '').strip()
    if v == 'Yes':
        return 'TRUE'
    if v == 'No':
        return 'FALSE'
    return 'NULL'


def yn_inv(val: str) -> str:
    """Inverted Yes/No (e.g. 'Animals present' → no_animals)."""
    v = (val or '').strip()
    if v == 'Yes':
        return 'FALSE'   # animals ARE present → no_animals = false
    if v == 'No':
        return 'TRUE'    # no animals → no_animals = true
    return 'NULL'


def sq(val: str) -> str:
    """Escape a string for SQL single-quote literal, or NULL."""
    v = (val or '').strip()
    if not v or v.lower() in ('na', 'n/a', 'none', 'anonymous', '-'):
        return 'NULL'
    return "'" + v.replace("'", "''") + "'"


def arr(val: str, sep: str = ';') -> str:
    """Semicolon-separated string → PostgreSQL ARRAY[...] literal."""
    v = (val or '').strip()
    if not v or v.lower() in ('na', 'n/a', 'none', '-', ''):
        return 'NULL'
    items = [i.strip() for i in v.split(sep) if i.strip()]
    if not items:
        return 'NULL'
    escaped = [i.replace("'", "''") for i in items]
    return 'ARRAY[' + ', '.join(f"'{e}'" for e in escaped) + ']'


def single_as_arr(val: str) -> str:
    """Wrap a single string value in a PostgreSQL ARRAY[...]."""
    v = (val or '').strip()
    if not v or v.lower() in ('na', 'n/a', 'none', '-', ''):
        return 'NULL'
    return "ARRAY['" + v.replace("'", "''") + "']"


def int_or_null(val: str) -> str:
    """String → SQL integer or NULL."""
    v = (val or '').strip()
    try:
        return str(int(float(v)))
    except Exception:
        return 'NULL'


# ── Compliance scoring (mirrors app/assessment/new/page.tsx) ──────────────────

def compliance_score(r: dict) -> int:
    score = 0
    if r.get(13) == 'Yes':  score += 15   # is_registered
    if r.get(17) == 'Yes':  score += 15   # has_coa
    if r.get(15) == 'Yes':  score += 10   # has_bank_account
    if r.get(24) == 'Yes':  score += 5    # cleanliness_ok
    if r.get(25) == 'Yes':  score += 5    # waste_ok
    if r.get(29) == 'No':   score += 5    # NOT food_on_floor
    if r.get(30) == 'No':   score += 5    # NOT expired_food
    if r.get(31) == 'Yes':  score += 5    # food_labelled
    if r.get(33) == 'Yes':  score += 5    # lighting_ok
    if r.get(34) == 'Yes':  score += 5    # floors_ok
    if r.get(36) == 'Yes':  score += 5    # safety_signage
    payments = [p for p in (r.get(39) or '').split(';') if p.strip()]
    if payments:            score += 5    # has payment methods
    if r.get(53) == 'Yes':  score += 5    # growth_potential
    storage = [s for s in (r.get(22) or '').split(';') if s.strip()]
    if storage:             score += 5    # has storage
    products = [p for p in (r.get(23) or '').split(';') if p.strip()]
    if len(products) > 2:   score += 5    # diverse products
    return min(score, 100)


def compliance_tier(score: int) -> int:
    if score >= 80: return 1
    if score >= 60: return 2
    if score >= 40: return 3
    return 4


def nef_score(r: dict) -> int:
    criteria = [
        r.get(45) == 'Yes',   # sa_citizen
        r.get(13) == 'Yes',   # registered_cipc (proxy for registered_cipc_nef)
        r.get(46) == 'Yes',   # willing_bank
        r.get(47) == 'Yes',   # willing_sars
        r.get(48) == 'Yes',   # valid_coa_nef
        r.get(49) == 'Yes',   # fixed_structure
        r.get(50) == 'Yes',   # in_operation_6m
        r.get(51) == 'Yes',   # hygiene_compliant
        r.get(52) == 'Yes',   # willing_training
        r.get(53) == 'Yes',   # growth_potential
    ]
    return sum(1 for c in criteria if c)


# ── XLSX reader ───────────────────────────────────────────────────────────────

def read_xlsx(path: str):
    with zipfile.ZipFile(path) as z:
        ss_raw = z.read('xl/sharedStrings.xml').decode('utf-8')
        strings = [
            html.unescape(s)
            for s in re.findall(r'<t[^>]*>(.*?)</t>', ss_raw, re.DOTALL)
        ]

        sheet = z.read('xl/worksheets/sheet1.xml').decode('utf-8')
        raw_rows = re.findall(
            r'<row[^>]*r="(\d+)"[^>]*>(.*?)</row>', sheet, re.DOTALL
        )

    def parse_row(xml: str) -> dict:
        cells: dict[int, str] = {}
        for m in re.finditer(r'<c r="([A-Z]+)\d+"[^>]*>(.*?)</c>', xml, re.DOTALL):
            idx = col_to_idx(m.group(1))
            inner = m.group(2)
            t_m = re.search(r't="([^"]+)"', m.group(0))
            v_m = re.search(r'<v>(.*?)</v>', inner, re.DOTALL)
            if v_m:
                val = v_m.group(1)
                if t_m and t_m.group(1) == 's':
                    si = int(val)
                    val = strings[si] if si < len(strings) else ''
                cells[idx] = val.strip()
            else:
                cells[idx] = ''
        return cells

    # Row 1 is header; rows 2+ are data
    return [parse_row(content) for _, content in raw_rows[1:]]


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    rows = read_xlsx(XLSX_PATH)

    out = sys.stdout
    out.write('-- ============================================================\n')
    out.write('-- NotoTrack: Step 2 – MS Forms Import Data\n')
    out.write(f'-- Generated: {datetime.now().isoformat()}\n')
    out.write(f'-- Source: SPAZA SHOP ASSESSMENT FORM(1-535).xlsx\n')
    out.write('-- GPS coordinates are NULL — add them via the map/edit view.\n')
    out.write('-- Run step1_migration.sql FIRST.\n')
    out.write('-- ============================================================\n\n')

    out.write('BEGIN;\n\n')

    imported = 0
    skipped = 0

    for r in rows:
        # Column 5 = Store Name (confirmed from data inspection)
        store_name = r.get(5, '').strip()
        if not store_name or store_name.lower() in ('na', 'n/a', ''):
            skipped += 1
            continue

        score   = compliance_score(r)
        tier    = compliance_tier(score)
        nef     = nef_score(r)

        submitted_at_raw = r.get(2, '')
        submitted_at_iso = excel_to_iso(submitted_at_raw)

        fieldworker = (r.get(61) or r.get(4) or '').strip()

        out.write('INSERT INTO public.assessments (\n')
        out.write('  agent_id, fieldworker_name, submitted_at, status,\n')
        out.write('  shop_name, owner_name, email, contact, address, municipality, ward_no,\n')
        out.write('  gps_lat, gps_lng,\n')
        out.write('  is_registered, cipc_number,\n')
        out.write('  has_bank_account, bank_name,\n')
        out.write('  has_coa, coa_number,\n')
        out.write('  years_operating, structure_type, store_size, storage, products,\n')
        out.write('  cleanliness_ok, waste_ok, no_dust, handwashing, no_animals,\n')
        out.write('  food_on_floor, expired_food, food_labelled, food_nonfood_separated,\n')
        out.write('  lighting_ok, floors_ok, cleaning_materials, safety_signage,\n')
        out.write('  disability_accessible, not_sleeping_space, yms_observations,\n')
        out.write('  payment_methods, has_pos, ordering_methods, makes_deliveries,\n')
        out.write('  click_collect, collection_point, space_security,\n')
        out.write('  monthly_turnover, num_employees, support_needed,\n')
        out.write('  sa_citizen, registered_cipc_nef, willing_bank, willing_sars,\n')
        out.write('  valid_coa_nef, fixed_structure, in_operation_6m,\n')
        out.write('  hygiene_compliant, willing_training, growth_potential,\n')
        out.write('  owner_signature,\n')
        out.write('  compliance_score, compliance_tier, nef_score\n')
        out.write(') VALUES (\n')
        out.write(f"  '{IMPORT_AGENT_ID}',\n")
        out.write(f"  {sq(fieldworker)},\n")
        out.write(f"  {sq(submitted_at_iso) if submitted_at_iso else 'NULL'},\n")
        out.write(f"  'synced',\n")
        # Identity
        out.write(f"  {sq(store_name)}, {sq(r.get(7,''))}, {sq(r.get(8,''))},\n")
        out.write(f"  {sq(r.get(9,''))}, {sq(r.get(10,''))},\n")
        out.write(f"  {sq(r.get(11,'').rstrip())}, {sq(r.get(12,''))},\n")
        # GPS
        out.write(f"  NULL, NULL,\n")
        # Registration
        out.write(f"  {yn(r.get(13,''))}, {sq(r.get(14,''))},\n")
        out.write(f"  {yn(r.get(15,''))}, {sq(r.get(16,''))},\n")
        out.write(f"  {yn(r.get(17,''))}, {sq(r.get(18,''))},\n")
        # Infrastructure
        out.write(f"  {sq(r.get(19,''))}, {sq(r.get(20,''))}, {sq(r.get(21,''))},\n")
        out.write(f"  {arr(r.get(22,''))}, {arr(r.get(23,''))},\n")
        # Hygiene
        out.write(f"  {yn(r.get(24,''))}, {yn(r.get(25,''))}, {yn(r.get(26,''))},\n")
        out.write(f"  {yn(r.get(27,''))}, {yn_inv(r.get(28,''))},\n")  # no_animals inverted
        # Food safety
        out.write(f"  {yn(r.get(29,''))}, {yn(r.get(30,''))},\n")  # food_on_floor, expired_food
        out.write(f"  {yn(r.get(31,''))}, {yn(r.get(32,''))},\n")
        # Safety
        out.write(f"  {yn(r.get(33,''))}, {yn(r.get(34,''))}, {yn(r.get(35,''))},\n")
        out.write(f"  {yn(r.get(36,''))},\n")
        out.write(f"  {yn(r.get(37,''))}, {yn(r.get(38,''))},\n")
        out.write(f"  {sq(r.get(59,''))},\n")  # yms_observations
        # Business
        out.write(f"  {arr(r.get(39,''))}, {yn(r.get(40,''))},\n")
        out.write(f"  {single_as_arr(r.get(41,''))}, {yn(r.get(42,''))},\n")
        out.write(f"  {yn(r.get(43,''))}, {single_as_arr(r.get(54,''))},\n")
        out.write(f"  {yn(r.get(55,''))},\n")
        out.write(f"  {sq(r.get(56,''))}, {int_or_null(r.get(57,''))},\n")
        out.write(f"  {single_as_arr(r.get(58,''))},\n")
        # NEF
        out.write(f"  {yn(r.get(45,''))}, {yn(r.get(13,''))},\n")   # sa_citizen, registered_cipc_nef (= is_registered)
        out.write(f"  {yn(r.get(46,''))}, {yn(r.get(47,''))},\n")
        out.write(f"  {yn(r.get(48,''))}, {yn(r.get(49,''))},\n")
        out.write(f"  {yn(r.get(50,''))},\n")
        out.write(f"  {yn(r.get(51,''))}, {yn(r.get(52,''))}, {yn(r.get(53,''))},\n")
        # Signatures & scores
        out.write(f"  {sq(r.get(60,''))},\n")  # owner_signature
        out.write(f"  {score}, {tier}, {nef}\n")
        out.write(');\n\n')

        imported += 1

    out.write('COMMIT;\n\n')
    out.write(f'-- Summary: {imported} records imported, {skipped} skipped (empty store name)\n')

    print(f'Generated SQL for {imported} records ({skipped} skipped)', file=sys.stderr)


if __name__ == '__main__':
    main()
