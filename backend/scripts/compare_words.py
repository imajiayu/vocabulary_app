#!/usr/bin/env python3
"""
Compare extracted words with database words.
Find out how many words from extracted_words.txt are not in the database.

Usage:
    Ensure DATABASE_URL is set in .env file, then run:
    python -m backend.scripts.compare_words
"""

import os
import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

# Load .env file
env_file = Path(__file__).parent.parent.parent / '.env'
if env_file.exists():
    for line in env_file.read_text().strip().split('\n'):
        if line and not line.startswith('#') and '=' in line:
            key, value = line.split('=', 1)
            os.environ[key] = value

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from backend.models.word import Word


def get_db_words():
    """Get all words from database."""
    DATABASE_URL = os.environ.get("DATABASE_URL")
    if not DATABASE_URL:
        raise RuntimeError("DATABASE_URL environment variable is required")

    engine = create_engine(DATABASE_URL)
    Session = sessionmaker(bind=engine)
    session = Session()

    try:
        words = session.query(Word.word).all()
        return set(word[0].lower() for word in words)
    finally:
        session.close()


def get_extracted_words(file_path):
    """Get all words from extracted file."""
    words = set()
    with open(file_path, 'r', encoding='utf-8') as f:
        for line in f:
            word = line.strip()
            if word:
                words.add(word.lower())
    return words


def main():
    # Setup paths
    project_root = Path(__file__).parent.parent.parent
    extracted_file = project_root / 'backend' / 'data' / 'extracted_words.txt'
    output_file = project_root / 'backend' / 'data' / 'missing_words.txt'

    # Check file exists
    if not extracted_file.exists():
        print(f"Error: File not found: {extracted_file}")
        sys.exit(1)

    print("Reading words from database...")
    db_words = get_db_words()
    print(f"Found {len(db_words)} words in database")

    print("Reading words from extracted file...")
    extracted_words = get_extracted_words(extracted_file)
    print(f"Found {len(extracted_words)} words in extracted file")

    # Find missing words
    missing_words = extracted_words - db_words
    print(f"\nMissing words: {len(missing_words)}")
    print(f"Percentage in database: {(len(extracted_words) - len(missing_words)) / len(extracted_words) * 100:.2f}%")

    # Write missing words to file
    if missing_words:
        with open(output_file, 'w', encoding='utf-8') as f:
            for word in sorted(missing_words):
                f.write(f"{word}\n")
        print(f"\nMissing words written to: {output_file}")

        # Show first 20 missing words
        print("\nFirst 20 missing words:")
        for word in sorted(missing_words)[:20]:
            print(f"  - {word}")
    else:
        print("\nAll words are in the database!")


if __name__ == '__main__':
    main()
