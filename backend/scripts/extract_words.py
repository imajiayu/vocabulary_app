#!/usr/bin/env python3
"""
Extract vocabulary words from IELTS-4000.txt file.
Reads the formatted text file and extracts only the words, writing them to a new file.
"""

import os
import sys
from pathlib import Path


def extract_words(input_file, output_file):
    """
    Extract words from IELTS vocabulary file.

    Args:
        input_file: Path to input file (IELTS-4000.txt)
        output_file: Path to output file (extracted words)
    """
    words = []

    with open(input_file, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()

            # Skip empty lines
            if not line:
                continue

            # Extract word if line contains colon
            if ':' in line:
                word = line.split(':', 1)[0].strip()
                # Skip if it looks like a header or non-word
                if word and not word.isupper() or word.lower() == word:
                    words.append(word)

    # Write extracted words to output file
    with open(output_file, 'w', encoding='utf-8') as f:
        for word in words:
            f.write(f"{word}\n")

    return len(words)


def main():
    # Setup paths
    project_root = Path(__file__).parent.parent.parent
    input_file = project_root / 'backend' / 'data' / 'IELTS-4000.txt'
    output_file = project_root / 'backend' / 'data' / 'extracted_words.txt'

    # Check input file exists
    if not input_file.exists():
        print(f"Error: Input file not found: {input_file}")
        sys.exit(1)

    # Extract words
    print(f"Reading from: {input_file}")
    count = extract_words(input_file, output_file)
    print(f"Extracted {count} words")
    print(f"Output written to: {output_file}")


if __name__ == '__main__':
    main()
