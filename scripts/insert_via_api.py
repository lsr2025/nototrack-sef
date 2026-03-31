#!/usr/bin/env python3
"""
NotoTrack: Insert 534 MS Forms records via Supabase REST API.
Uses actual DB column names (is_cipc_registered, food_not_on_floor, etc.)
Calculates compliance_score, compliance_tier, nef_score.
Inserts in batches of 100.
"""

import zipfile, re, html, sys, json
from datetime import datetime, timedelta
from urllib.request import urlopen, Request
from urllib.error import HTTPError

XLSX_PATH = (
    '/Users/administatror/Library/Mobile Documents/'
    'com~apple~CloudDocs/YamiMine/'
    'YMS x SEF x Ent Ilembe x Msinsi/notoTrack/'
    'SPAZA SHOP ASSESSMENT FORM(1-535).xlsx'
)

SUPABASE_URL  = 'https://rwkdcreimzpieennuwnj.supabase.co'
SERVICE_KEY   = (
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.'
    'eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ3a2RjcmVpbXpwaWVlbm51d25qIiwicm9sZSI6'
    'InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzkxNDg4NCwiZXhwIjoyMDg5NDkwODg0fQ.'
    'camBgqDmBtuGMjp8BN_6Kk0sWL8Tyk1RyVFNNoGHKQ8'
)
BATCH   = 100
REFRESH = '--refresh' in __import__('sys').argv   # delete all synced records first

# ── XLSX helpers ──────────────────────────────────────────────────────────────

def col_to_idx(col_str):
    result = 0
    for c in col_str:
        result = result * 26 + (ord(c) - ord('A') + 1)
    return result - 1

def excel_to_iso(serial):
    try:
        f = float(serial)
        if f <= 0: return None
        return (datetime(1899, 12, 30) + timedelta(days=f)).isoformat()
    except Exception:
        return None

def read_xlsx(path):
    with zipfile.ZipFile(path) as z:
        ss_raw = z.read('xl/sharedStrings.xml').decode('utf-8')
        strings = [html.unescape(s) for s in re.findall(r'<t[^>]*>(.*?)</t>', ss_raw, re.DOTALL)]
        sheet = z.read('xl/worksheets/sheet1.xml').decode('utf-8')
        raw_rows = re.findall(r'<row[^>]*r="\d+"[^>]*>(.*?)</row>', sheet, re.DOTALL)

    def parse_row(xml):
        cells = {}
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

    return [parse_row(content) for content in raw_rows[1:]]

# ── Value converters ──────────────────────────────────────────────────────────

def yn(val):
    v = (val or '').strip()
    if v == 'Yes': return True
    if v == 'No':  return False
    return None

def yn_inv(val):
    """Inverted: 'Yes' (problem present) → False, 'No' (no problem) → True."""
    v = (val or '').strip()
    if v == 'Yes': return False
    if v == 'No':  return True
    return None

def sq(val):
    v = (val or '').strip()
    if not v or v.lower() in ('na', 'n/a', 'none', 'anonymous', '-'): return None
    return v

def arr(val, sep=';'):
    v = (val or '').strip()
    if not v or v.lower() in ('na', 'n/a', 'none', '-', ''): return None
    items = [i.strip() for i in v.split(sep) if i.strip()]
    return items if items else None

def int_or_null(val):
    try: return int(float((val or '').strip()))
    except Exception: return None

# ── Scoring ───────────────────────────────────────────────────────────────────

def compliance_score(r):
    score = 0
    if r.get(13) == 'Yes': score += 15  # is_cipc_registered
    if r.get(17) == 'Yes': score += 15  # has_coa
    if r.get(15) == 'Yes': score += 10  # has_bank_account
    if r.get(24) == 'Yes': score += 5   # cleanliness_ok
    if r.get(25) == 'Yes': score += 5   # waste_ok
    if r.get(29) == 'No':  score += 5   # food NOT on floor
    if r.get(30) == 'No':  score += 5   # no expired food
    if r.get(31) == 'Yes': score += 5   # food_labelled
    if r.get(33) == 'Yes': score += 5   # lighting_ok
    if r.get(34) == 'Yes': score += 5   # floors_ok
    if r.get(36) == 'Yes': score += 5   # safety_signage
    payments = [p for p in (r.get(39) or '').split(';') if p.strip()]
    if payments:            score += 5
    if r.get(53) == 'Yes': score += 5   # growth_potential
    storage = [s for s in (r.get(22) or '').split(';') if s.strip()]
    if storage:             score += 5
    products = [p for p in (r.get(23) or '').split(';') if p.strip()]
    if len(products) > 2:   score += 5
    return min(score, 100)

def compliance_tier(score):
    if score >= 80: return 1
    if score >= 60: return 2
    if score >= 40: return 3
    return 4

def nef_score(r):
    return sum(1 for c in [
        r.get(45) == 'Yes',  # sa_citizen
        r.get(13) == 'Yes',  # is_cipc_registered
        r.get(46) == 'Yes',  # willing_bank
        r.get(47) == 'Yes',  # willing_sars
        r.get(48) == 'Yes',  # valid_coa_nef
        r.get(49) == 'Yes',  # fixed_structure
        r.get(50) == 'Yes',  # in_operation_6m
        r.get(51) == 'Yes',  # hygiene_compliant
        r.get(52) == 'Yes',  # willing_training
        r.get(53) == 'Yes',  # growth_potential
    ] if c)

# ── REST API insert ───────────────────────────────────────────────────────────

def api_insert(records):
    url = f'{SUPABASE_URL}/rest/v1/assessments'
    data = json.dumps(records).encode('utf-8')
    req = Request(url, data=data, method='POST')
    req.add_header('apikey', SERVICE_KEY)
    req.add_header('Authorization', f'Bearer {SERVICE_KEY}')
    req.add_header('Content-Type', 'application/json')
    req.add_header('Prefer', 'return=minimal')
    try:
        with urlopen(req) as resp:
            return resp.status, None
    except HTTPError as e:
        body = e.read().decode('utf-8')
        return e.code, body

# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    print('Reading XLSX...', file=sys.stderr)
    rows = read_xlsx(XLSX_PATH)

    records = []
    skipped = 0

    for r in rows:
        store_name = sq(r.get(5, ''))
        if not store_name:
            skipped += 1
            continue

        score = compliance_score(r)
        tier  = compliance_tier(score)
        nef   = nef_score(r)
        submitted_iso = excel_to_iso(r.get(2, ''))
        fieldworker   = sq(r.get(61) or r.get(4) or '')

        rec = {
            'shop_name':          store_name,
            'owner_name':         sq(r.get(7, '')),
            'owner_email':        sq(r.get(8, '')),
            'contact_number':     sq(r.get(9, '')),
            'address':            sq(r.get(10, '')),
            'municipality':       sq((r.get(11, '') or '').rstrip()),
            'ward_no':            sq(r.get(12, '')),
            'fieldworker_name':   fieldworker,
            'submitted_at':       submitted_iso,
            'status':             'synced',
            # Registration
            'is_cipc_registered': yn(r.get(13, '')),
            'cipc_number':        sq(r.get(14, '')),
            'has_bank_account':   yn(r.get(15, '')),
            'bank_name':          sq(r.get(16, '')),
            'has_coa':            yn(r.get(17, '')),
            'coa_number':         sq(r.get(18, '')),
            # Infrastructure
            'years_operating':    sq(r.get(19, '')),
            'structure_type':     sq(r.get(20, '')),
            'store_size':         sq(r.get(21, '')),
            'storage':            arr(r.get(22, '')),
            'products':           arr(r.get(23, '')),
            # Hygiene
            'cleanliness_ok':     yn(r.get(24, '')),
            'waste_ok':           yn(r.get(25, '')),
            'no_dust':            yn(r.get(26, '')),
            'handwashing':        yn(r.get(27, '')),
            'no_animals':         yn_inv(r.get(28, '')),   # inverted
            # Food safety (inverted: "Is there food on floor?" No→good)
            'food_not_on_floor':  yn_inv(r.get(29, '')),  # inverted
            'no_expired_food':    yn_inv(r.get(30, '')),  # inverted
            'food_labelled':      yn(r.get(31, '')),
            'food_nonfood_separated': yn(r.get(32, '')),
            # Safety
            'lighting_ok':        yn(r.get(33, '')),
            'floors_ok':          yn(r.get(34, '')),
            'cleaning_materials': yn(r.get(35, '')),
            'safety_signage':     yn(r.get(36, '')),
            'disability_accessible': yn(r.get(37, '')),
            'not_sleeping_space': yn(r.get(38, '')),
            'yms_observations':   sq(r.get(59, '')),
            # Business
            'payment_methods':    arr(r.get(39, '')),
            'has_pos':            yn(r.get(40, '')),
            'ordering_method':    sq(r.get(41, '')),
            'makes_deliveries':   yn(r.get(42, '')),
            'click_collect':      yn(r.get(43, '')),
            'collect_method':     sq(r.get(54, '')),
            'space_security':     yn(r.get(55, '')),
            'monthly_turnover':   sq(r.get(56, '')),
            'num_employees':      int_or_null(r.get(57, '')),
            'support_needed':     arr(r.get(58, '')),
            # NEF eligibility
            'sa_citizen':         yn(r.get(45, '')),
            'willing_bank':       yn(r.get(46, '')),
            'willing_sars':       yn(r.get(47, '')),
            'valid_coa_nef':      yn(r.get(48, '')),
            'fixed_structure':    yn(r.get(49, '')),
            'in_operation_6m':    yn(r.get(50, '')),
            'hygiene_compliant':  yn(r.get(51, '')),
            'willing_training':   yn(r.get(52, '')),
            'growth_potential':   yn(r.get(53, '')),
            # Scores
            'compliance_score':   score,
            'compliance_tier':    tier,
            'nef_score':          nef,
        }
        # Strip None values so PostgREST uses column defaults
        rec = {k: v for k, v in rec.items() if v is not None}
        records.append(rec)

    print(f'{len(records)} records to insert, {skipped} skipped', file=sys.stderr)

    if REFRESH:
        print('--refresh: deleting all existing synced records...', file=sys.stderr)
        # Delete in batches via id list to avoid URL length limits
        from urllib.request import urlopen, Request
        req = Request(f'{SUPABASE_URL}/rest/v1/assessments?status=eq.synced', method='DELETE')
        req.add_header('apikey', SERVICE_KEY)
        req.add_header('Authorization', f'Bearer {SERVICE_KEY}')
        req.add_header('Prefer', 'return=minimal')
        try:
            with urlopen(req) as r:
                print(f'  Cleared synced records (HTTP {r.status})', file=sys.stderr)
        except Exception as e:
            print(f'  Delete error: {e}', file=sys.stderr)

    # PostgREST requires all records in a batch to have identical keys
    all_keys = sorted({k for r in records for k in r})
    records  = [{k: r.get(k, None) for k in all_keys} for r in records]

    inserted = 0
    errors   = 0
    for i in range(0, len(records), BATCH):
        batch = records[i:i + BATCH]
        status, err = api_insert(batch)
        if status in (200, 201, 204):
            inserted += len(batch)
            print(f'  Inserted batch {i//BATCH + 1}: {inserted}/{len(records)}', file=sys.stderr)
        else:
            errors += len(batch)
            print(f'  ERROR batch {i//BATCH + 1}: HTTP {status}', file=sys.stderr)
            if err:
                print(f'    {err[:300]}', file=sys.stderr)

    print(f'\nDone: {inserted} inserted, {errors} errors', file=sys.stderr)
    tiers = [compliance_tier(compliance_score(r)) for r in rows if sq(r.get(5,''))]
    print(f'Tier breakdown: T1={tiers.count(1)}, T2={tiers.count(2)}, T3={tiers.count(3)}, T4={tiers.count(4)}', file=sys.stderr)

if __name__ == '__main__':
    main()
