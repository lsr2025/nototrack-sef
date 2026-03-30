#!/usr/bin/env python3
"""
NotoTrack GPS Coordinate Matcher
Parses WhatsApp chat coordinates, fuzzy-matches to XLSX shop names,
and generates SQL UPDATEs + a CSV review file.

Usage:
    python3 scripts/generate_gps_updates.py

Outputs:
    scripts/step3_gps_updates.sql   — SQL UPDATEs for high-confidence matches
    scripts/gps_review.csv          — All coordinates with match info for manual review
"""

import zipfile, re, html, csv, sys
from difflib import SequenceMatcher
from datetime import datetime

# ── Paths ─────────────────────────────────────────────────────────────────────

XLSX_PATH = (
    '/Users/administatror/Library/Mobile Documents/'
    'com~apple~CloudDocs/YamiMine/'
    'YMS x SEF x Ent Ilembe x Msinsi/notoTrack/'
    'SPAZA SHOP ASSESSMENT FORM(1-535).xlsx'
)
CHAT_PATH = (
    '/Users/administatror/Library/Mobile Documents/'
    'com~apple~CloudDocs/YamiMine/'
    'YMS x SEF x Ent Ilembe x Msinsi/FINALnotoEnviro/'
    'WhatsApp Chat - Ilembe  Coordinates \U0001f4cd/_chat.txt'
)
SQL_OUT  = 'scripts/step3_gps_updates.sql'
CSV_OUT  = 'scripts/gps_review.csv'

# Match threshold: 0.0-1.0. ≥ this → auto-UPDATE; below → manual review only
AUTO_MATCH_THRESHOLD = 0.72

# ── XLSX shop list ─────────────────────────────────────────────────────────────

def load_xlsx_shops(path):
    """Return list of {shop_name, ward_no, municipality} dicts from the XLSX."""
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

    def col_to_idx(col):
        result = 0
        for c in col:
            result = result * 26 + (ord(c) - ord('A') + 1)
        return result - 1

    def parse_row(xml):
        cells = {}
        for m in re.finditer(r'<c r="([A-Z]+)\d+"[^>]*>(.*?)</c>', xml, re.DOTALL):
            idx = col_to_idx(m.group(1))
            inner = m.group(2)
            t_m = re.search(r't="([^"]+)"', m.group(0))
            v_m = re.search(r'<v>(.*?)</v>', inner)
            if v_m:
                val = v_m.group(1)
                if t_m and t_m.group(1) == 's':
                    si = int(val)
                    val = strings[si] if si < len(strings) else ''
                cells[idx] = val.strip()
        return cells

    shops = []
    for _, content in raw_rows[1:]:
        r = parse_row(content)
        name = r.get(5, '').strip()
        if name and name.lower() not in ('na', 'n/a', ''):
            shops.append({
                'shop_name': name,
                'ward_no':   r.get(12, '').strip(),
                'municipality': r.get(11, '').strip().rstrip(),
            })
    return shops


# ── WhatsApp chat parser ──────────────────────────────────────────────────────

# Regex to match the start of a WhatsApp message line
MSG_RE = re.compile(
    r'^\[(\d{4}/\d{2}/\d{2}, \d{2}:\d{2}:\d{2})\] ([^:]+): (.*)$'
)
# Regex to extract lat/lng from Google Maps URL
GPS_RE = re.compile(r'q=(-?\d+\.\d+),(-?\d+\.\d+)')
# Named location format: "Name (area): https://maps.google.com/?q=..."
NAMED_GPS_RE = re.compile(r'^(.*?):\s*https://maps\.google\.com/\?q=(-?\d+\.\d+),(-?\d+\.\d+)')


def parse_chat(path):
    """
    Parse WhatsApp chat and return list of coordinate entries:
    {lat, lng, raw_context, shop_hint, ward_hint, municipality_hint}
    """
    with open(path, encoding='utf-8') as f:
        raw = f.read()

    # Split into message blocks, handling multi-line messages
    messages = []
    current = None
    for line in raw.splitlines():
        m = MSG_RE.match(line)
        if m:
            if current:
                messages.append(current)
            current = {
                'time':   m.group(1),
                'sender': m.group(2).strip(),
                'text':   m.group(3),
            }
        elif current:
            current['text'] += '\n' + line

    if current:
        messages.append(current)

    # Extract coordinates with context
    coords = []
    n = len(messages)

    for i, msg in enumerate(messages):
        text = msg['text']

        # Remove WhatsApp LTR mark
        text = text.replace('\u200e', '').strip()

        # Pattern A: named location "Label (area): https://...?q=lat,lng"
        nm = NAMED_GPS_RE.match(text)
        if nm:
            label = nm.group(1).strip()
            lat   = float(nm.group(2))
            lng   = float(nm.group(3))
            # Extract shop hint from the label (drop everything in parens)
            shop_hint = re.sub(r'\s*\(.*?\)', '', label).strip()
            coords.append({
                'lat': lat, 'lng': lng,
                'raw_context': text,
                'shop_hint': shop_hint,
                'ward_hint': '',
                'municipality_hint': '',
            })
            continue

        # Pattern B: bare location share
        gm = GPS_RE.search(text)
        if gm and ('maps.google' in text or 'Location:' in text):
            lat = float(gm.group(1))
            lng = float(gm.group(2))

            # Gather context from the next 1-2 messages (same sender)
            context_parts = []
            for j in range(i + 1, min(i + 3, n)):
                next_msg = messages[j]
                next_text = next_msg['text'].replace('\u200e', '').strip()
                # Stop if it's another location share
                if GPS_RE.search(next_text) and 'maps.google' in next_text:
                    break
                if next_msg['sender'] == msg['sender']:
                    context_parts.append(next_text)
                else:
                    break

            context = '\n'.join(context_parts)
            shop_hint, ward_hint, municipality_hint = extract_context(context)

            coords.append({
                'lat': lat, 'lng': lng,
                'raw_context': context,
                'shop_hint': shop_hint,
                'ward_hint': ward_hint,
                'municipality_hint': municipality_hint,
            })

    return coords


def extract_context(text):
    """
    From a context block of text, extract shop name hint, ward, and municipality.
    """
    if not text:
        return '', '', ''

    lines = [l.strip() for l in text.replace('\n', ' / ').split('/') if l.strip()]

    # Extract ward number
    ward_m = re.search(r'[Ww]ard\s*(\d+)', text)
    ward_hint = ward_m.group(1) if ward_m else ''

    # Extract municipality keywords
    municipality_hint = ''
    for kw in ['KwaDukuza', 'KwaMaphumulo', 'Maphumulo', 'Ndwedwe', 'Mandeni', 'Maphumulo']:
        if kw.lower() in text.lower():
            municipality_hint = kw
            break

    # Shop name: try to find the most shop-like part
    # Remove team leader info, supervisor info, ward info
    shop_text = text
    shop_text = re.sub(r'[Ww]ard\s*\d+', '', shop_text)
    shop_text = re.sub(r'[Tt]eam\s*[Ll]eader[:\s].*', '', shop_text)
    shop_text = re.sub(r'[Ss]upervisor[:\s].*', '', shop_text)
    shop_text = re.sub(r'[Tt]eamleader[:\s].*', '', shop_text)
    shop_text = re.sub(r'KwaDukuza|KwaMaphumulo|Maphumulo|Ndwedwe|Mandeni', '', shop_text, flags=re.I)
    shop_text = re.sub(r'\s+', ' ', shop_text).strip(' /\n,.')

    return shop_text, ward_hint, municipality_hint


# ── Fuzzy matching ─────────────────────────────────────────────────────────────

NOISE = re.compile(
    r'\b(tuck|tuckshop|shop|store|trading|general|dealer|supermarket|spaza|'
    r'enterprise|tuck\s*shop|emporium|tuck shop)\b',
    re.I
)

def normalize(name):
    """Lowercase, strip punctuation and noise words for comparison."""
    n = name.lower()
    n = NOISE.sub('', n)
    n = re.sub(r"[^a-z0-9\s]", '', n)
    n = re.sub(r'\s+', ' ', n).strip()
    return n


def similarity(a, b):
    return SequenceMatcher(None, normalize(a), normalize(b)).ratio()


def best_match(hint, shops):
    """Find the best matching shop from the list. Returns (shop, score)."""
    if not hint or not hint.strip():
        return None, 0.0

    best_shop  = None
    best_score = 0.0

    hint_norm = normalize(hint)
    if not hint_norm:
        return None, 0.0

    for shop in shops:
        shop_norm = normalize(shop['shop_name'])
        s = SequenceMatcher(None, hint_norm, shop_norm).ratio()

        # Bonus: if hint_norm is a substring of shop_norm or vice versa
        if hint_norm in shop_norm or shop_norm in hint_norm:
            s = max(s, 0.80)

        if s > best_score:
            best_score = s
            best_shop  = shop

    return best_shop, best_score


# ── Deduplication ─────────────────────────────────────────────────────────────

def dedup_coords(coords):
    """Remove exact duplicate (lat, lng) pairs, keeping the one with most context."""
    seen = {}
    for c in coords:
        key = (round(c['lat'], 6), round(c['lng'], 6))
        if key not in seen or len(c['shop_hint']) > len(seen[key]['shop_hint']):
            seen[key] = c
    return list(seen.values())


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    print('Loading XLSX shop list...', file=sys.stderr)
    shops = load_xlsx_shops(XLSX_PATH)
    print(f'  {len(shops)} shops loaded.', file=sys.stderr)

    print('Parsing WhatsApp chat...', file=sys.stderr)
    coords = parse_chat(CHAT_PATH)
    coords = dedup_coords(coords)
    print(f'  {len(coords)} unique coordinates extracted.', file=sys.stderr)

    # Match each coordinate to a shop
    results = []
    for c in coords:
        shop, score = best_match(c['shop_hint'], shops)
        results.append({
            **c,
            'match_name':  shop['shop_name'] if shop else '',
            'match_ward':  shop['ward_no']   if shop else '',
            'match_muni':  shop['municipality'] if shop else '',
            'score':       score,
            'auto':        score >= AUTO_MATCH_THRESHOLD,
        })

    # Sort: auto-matches first, then by score desc
    results.sort(key=lambda r: (-int(r['auto']), -r['score']))

    auto_count   = sum(1 for r in results if r['auto'])
    manual_count = len(results) - auto_count
    print(f'  Auto-match ({AUTO_MATCH_THRESHOLD:.0%}+): {auto_count}', file=sys.stderr)
    print(f'  Manual review needed: {manual_count}', file=sys.stderr)

    # ── Write SQL ──────────────────────────────────────────────────────────────
    with open(SQL_OUT, 'w', encoding='utf-8') as f:
        f.write('-- ============================================================\n')
        f.write('-- NotoTrack: Step 3 – GPS Coordinate Updates\n')
        f.write(f'-- Generated: {datetime.now().isoformat()}\n')
        f.write(f'-- Auto-matched: {auto_count} shops (score ≥ {AUTO_MATCH_THRESHOLD:.0%})\n')
        f.write(f'-- Manual review: {manual_count} coords in gps_review.csv\n')
        f.write('-- ============================================================\n\n')
        f.write('BEGIN;\n\n')

        for r in results:
            if not r['auto']:
                continue
            shop_name_esc = r['match_name'].replace("'", "''")
            f.write(f"-- {r['match_name']} (score: {r['score']:.2f})\n")
            f.write(
                f"UPDATE public.assessments\n"
                f"  SET gps_lat = {r['lat']}, gps_lng = {r['lng']}\n"
                f"  WHERE gps_lat IS NULL\n"
                f"    AND LOWER(shop_name) = LOWER('{shop_name_esc}');\n\n"
            )

        f.write('COMMIT;\n')

    print(f'SQL written to {SQL_OUT}', file=sys.stderr)

    # ── Write CSV ──────────────────────────────────────────────────────────────
    with open(CSV_OUT, 'w', newline='', encoding='utf-8') as f:
        w = csv.writer(f)
        w.writerow([
            'lat', 'lng',
            'chat_hint', 'ward_hint', 'municipality_hint',
            'matched_shop_name', 'matched_ward', 'matched_municipality',
            'match_score', 'auto_applied',
            'raw_context',
        ])
        for r in results:
            w.writerow([
                r['lat'], r['lng'],
                r['shop_hint'], r['ward_hint'], r['municipality_hint'],
                r['match_name'], r['match_ward'], r['match_muni'],
                f"{r['score']:.2f}", 'YES' if r['auto'] else 'NO',
                r['raw_context'].replace('\n', ' | '),
            ])

    print(f'CSV written to {CSV_OUT}', file=sys.stderr)
    print(f'\nDone. Run step3_gps_updates.sql in Supabase SQL Editor.', file=sys.stderr)
    print(f'Review gps_review.csv to manually match the remaining {manual_count} coordinates.', file=sys.stderr)


if __name__ == '__main__':
    main()
