#!/usr/bin/env python3
"""
Build dictionary/parlova_dict.db from kaikki JSONL files.
Run once from project root: python build_dict.py

Input:  dictionary/kaikki.org-dictionary-German.jsonl  (~943 MB)
        dictionary/kaikki.org-dictionary-English.jsonl (~2.7 GB)
Output: dictionary/parlova_dict.db
"""
import json
import sqlite3
import sys
from pathlib import Path

DB_PATH  = Path("dictionary/parlova_dict.db")
DE_JSONL = Path("dictionary/kaikki.org-dictionary-German.jsonl")
EN_JSONL = Path("dictionary/kaikki.org-dictionary-English.jsonl")

GENDER_MAP = {"m": "masculine", "f": "feminine", "n": "neuter", "nt": "neuter"}

# Tags that identify non-standard German dialects — skip these translations
DIALECT_TAGS = {
    "Alemannic-German", "Low-German", "Austrian-German", "Swiss-German",
    "Pennsylvania-German", "Hunsrik", "Cimbrian", "Transylvanian-Saxon",
    "Plautdietsch", "Yiddish",
}

GENDER_TAGS = {"masculine": "m", "feminine": "f", "neuter": "n"}


def _extract_gender(entry: dict) -> str | None:
    """Extract grammatical gender for German nouns from head_templates args."""
    for ht in entry.get("head_templates", []):
        arg1 = ht.get("args", {}).get("1", "")
        g = arg1.split(",")[0].strip()
        if g in GENDER_MAP:
            return GENDER_MAP[g]
    return None


def build_de(conn: sqlite3.Connection) -> None:
    conn.execute("""
        CREATE TABLE IF NOT EXISTS de_entries (
            word         TEXT PRIMARY KEY,
            pos          TEXT,
            gender       TEXT,
            translations TEXT NOT NULL,
            example      TEXT
        )
    """)
    conn.execute("CREATE INDEX IF NOT EXISTS idx_de_word ON de_entries(word)")

    print("Building DE → EN  (German dictionary)...")
    batch: list[tuple] = []
    inserted = skipped = 0

    with open(DE_JSONL, encoding="utf-8") as f:
        for line_num, line in enumerate(f, 1):
            if line_num % 100_000 == 0:
                print(f"  {line_num:,} lines  |  {inserted:,} inserted", flush=True)

            try:
                entry = json.loads(line)
            except json.JSONDecodeError:
                continue

            word = entry.get("word", "").strip().lower()
            if not word:
                continue

            pos = entry.get("pos", "")
            gender = _extract_gender(entry) if pos == "noun" else None

            translations: list[str] = []
            example: str | None = None

            for sense in entry.get("senses", []):
                for gloss in sense.get("glosses", []):
                    g = gloss.strip()
                    if g and g not in translations:
                        translations.append(g)
                if example is None:
                    for ex in sense.get("examples", []):
                        t = ex.get("text", "").strip()
                        if t:
                            example = t
                            break

            if not translations:
                skipped += 1
                continue

            batch.append((word, pos, gender, json.dumps(translations, ensure_ascii=False), example))
            inserted += 1

            if len(batch) >= 5_000:
                conn.executemany("INSERT OR IGNORE INTO de_entries VALUES (?,?,?,?,?)", batch)
                conn.commit()
                batch.clear()

    if batch:
        conn.executemany("INSERT OR IGNORE INTO de_entries VALUES (?,?,?,?,?)", batch)
        conn.commit()

    print(f"  DE → EN complete: {inserted:,} entries  ({skipped:,} skipped — no glosses)\n")


def build_en(conn: sqlite3.Connection) -> None:
    conn.execute("""
        CREATE TABLE IF NOT EXISTS en_entries (
            word         TEXT PRIMARY KEY,
            pos          TEXT,
            translations TEXT NOT NULL,
            example      TEXT
        )
    """)
    conn.execute("CREATE INDEX IF NOT EXISTS idx_en_word ON en_entries(word)")

    print("Building EN → DE  (English dictionary)...")
    batch: list[tuple] = []
    inserted = skipped = 0

    with open(EN_JSONL, encoding="utf-8") as f:
        for line_num, line in enumerate(f, 1):
            if line_num % 100_000 == 0:
                print(f"  {line_num:,} lines  |  {inserted:,} inserted", flush=True)

            try:
                entry = json.loads(line)
            except json.JSONDecodeError:
                continue

            word = entry.get("word", "").strip().lower()
            if not word:
                continue

            pos = entry.get("pos", "")
            de_words: list[str] = []
            seen: set[str] = set()

            for t in entry.get("translations", []):
                if t.get("lang_code") != "de":
                    continue
                de_word = t.get("word", "").strip()
                if not de_word or de_word in seen:
                    continue
                tags = set(t.get("tags", []))
                if tags & DIALECT_TAGS:
                    continue
                seen.add(de_word)
                # Append inline gender hint: "Hund (m)"
                gender_hint = next((GENDER_TAGS[tag] for tag in GENDER_TAGS if tag in tags), None)
                de_words.append(f"{de_word} ({gender_hint})" if gender_hint else de_word)

            if not de_words:
                skipped += 1
                continue

            batch.append((word, pos, json.dumps(de_words, ensure_ascii=False), None))
            inserted += 1

            if len(batch) >= 5_000:
                conn.executemany("INSERT OR IGNORE INTO en_entries VALUES (?,?,?,?)", batch)
                conn.commit()
                batch.clear()

    if batch:
        conn.executemany("INSERT OR IGNORE INTO en_entries VALUES (?,?,?,?)", batch)
        conn.commit()

    print(f"  EN → DE complete: {inserted:,} entries  ({skipped:,} skipped — no DE translations)\n")


def main() -> None:
    for path in (DE_JSONL, EN_JSONL):
        if not path.exists():
            print(f"ERROR: {path} not found", file=sys.stderr)
            sys.exit(1)

    DB_PATH.parent.mkdir(exist_ok=True)
    for path in (DB_PATH, DB_PATH.with_suffix(".db-shm"), DB_PATH.with_suffix(".db-wal")):
        if path.exists():
            path.unlink()
            print(f"Removed {path}")
    print()

    conn = sqlite3.connect(DB_PATH)
    # Speed up bulk inserts
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA synchronous=NORMAL")
    conn.execute("PRAGMA cache_size=-65536")  # 64 MB page cache

    try:
        build_de(conn)
        build_en(conn)

        de_count = conn.execute("SELECT COUNT(*) FROM de_entries").fetchone()[0]
        en_count = conn.execute("SELECT COUNT(*) FROM en_entries").fetchone()[0]
        db_mb    = DB_PATH.stat().st_size / 1024 / 1024

        print("=" * 48)
        print(f"  DE entries : {de_count:,}")
        print(f"  EN entries : {en_count:,}")
        print(f"  DB size    : {db_mb:.1f} MB")
        print("=" * 48)
    finally:
        conn.close()


if __name__ == "__main__":
    main()
