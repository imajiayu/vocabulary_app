#!/usr/bin/env python3
"""
Compare extracted words with database words.
Find out how many words from extracted_words.txt are not in the database.
"""

import sys
from pathlib import Path
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from web_app.models.word import Word, Base
from web_app.config import DB_PATH


def get_db_words():
    """Get all words from database."""
    engine = create_engine(f'sqlite:///{DB_PATH}')
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
    extracted_file = project_root / 'web_app' / 'data' / 'extracted_words.txt'
    output_file = project_root / 'web_app' / 'data' / 'missing_words.txt'

    # Check file exists
    if not extracted_file.exists():
        print(f"Error: File not found: {extracted_file}")
        sys.exit(1)

    # Check database exists
    if not Path(DB_PATH).exists():
        print(f"Error: Database not found: {DB_PATH}")
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
