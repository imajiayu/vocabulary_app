#!/usr/bin/env python3
"""
Script to find words in database that are not in Magoosh_words.txt
"""

import sqlite3

def find_missing_words(db_path, magoosh_file, output_file):
    """
    Find words in database that are not in Magoosh word list.

    Args:
        db_path: Path to the SQLite database
        magoosh_file: Path to Magoosh_words.txt
        output_file: Path to output file for missing words
    """
    # Read Magoosh words into a set (case-insensitive)
    magoosh_words = set()
    with open(magoosh_file, 'r', encoding='utf-8') as f:
        for line in f:
            word = line.strip().lower()
            if word:
                magoosh_words.add(word)

    print(f"Loaded {len(magoosh_words)} words from Magoosh list")

    # Connect to database and get all words
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    cursor.execute("SELECT DISTINCT word FROM words ORDER BY word")
    db_words = [row[0] for row in cursor.fetchall()]

    conn.close()

    print(f"Found {len(db_words)} words in database")

    # Find missing words (in Magoosh but not in database)
    db_words_lower = set(word.lower() for word in db_words)
    missing_words = []
    for word in sorted(magoosh_words):
        if word not in db_words_lower:
            missing_words.append(word)

    # Write to output file
    with open(output_file, 'w', encoding='utf-8') as f:
        for word in missing_words:
            f.write(word + '\n')

    print(f"Found {len(missing_words)} words in Magoosh list not in database")
    print(f"Output written to {output_file}")

if __name__ == '__main__':
    db_path = 'vocabulary.db'
    magoosh_file = 'web_app/data/Magoosh_words.txt'
    output_file = 'web_app/data/gre_missing_words.txt'

    find_missing_words(db_path, magoosh_file, output_file)
