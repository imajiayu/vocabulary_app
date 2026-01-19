#!/usr/bin/env python3
"""
Interactive word filter for missing_words.txt
Display words one by one and allow user to keep (y) or remove (n)
Processes missing_words.txt in-place and appends kept words to filtered_words.txt
"""

import sys
import tty
import termios
from pathlib import Path


def getch():
    """Read a single character from stdin without requiring Enter."""
    fd = sys.stdin.fileno()
    old_settings = termios.tcgetattr(fd)
    try:
        tty.setraw(fd)
        ch = sys.stdin.read(1)
    finally:
        termios.tcsetattr(fd, termios.TCSADRAIN, old_settings)
    return ch


def filter_words(input_file, output_file):
    """
    Interactively filter words.
    Updates missing_words.txt in real-time and appends to filtered_words.txt

    Args:
        input_file: Path to missing_words.txt (will be modified)
        output_file: Path to filtered_words.txt (will append)
    """
    # Read all remaining words
    with open(input_file, 'r', encoding='utf-8') as f:
        words = [line.strip() for line in f if line.strip()]

    if not words:
        print("No words to process!")
        return

    initial_total = len(words)
    kept_count = 0
    removed_count = 0

    print(f"Remaining words to review: {initial_total}")
    print("Commands: y=keep, n=remove, q=quit\n")

    while words:
        word = words[0]
        remaining = len(words)
        processed = initial_total - remaining + 1

        while True:
            print(f"\n[{processed}/{initial_total}] Word: {word} (Remaining: {remaining})")
            print("Keep? (y/n/q): ", end='', flush=True)
            choice = getch().lower()

            if choice == 'y':
                # Append to filtered_words.txt
                with open(output_file, 'a', encoding='utf-8') as f:
                    f.write(f"{word}\n")
                kept_count += 1
                print("y ✓ Kept")
                break
            elif choice == 'n':
                removed_count += 1
                print("n ✗ Removed")
                break
            elif choice == 'q':
                print("q\nQuitting...")
                print_summary(kept_count, removed_count, len(words))
                return
            else:
                print(f"{choice} - Invalid input. Use y/n/q", end='\r')

        # Remove processed word from list
        words.pop(0)

        # Update missing_words.txt (remove processed word)
        with open(input_file, 'w', encoding='utf-8') as f:
            for w in words:
                f.write(f"{w}\n")

    # All words processed
    print_summary(kept_count, removed_count, 0)


def print_summary(kept, removed, remaining):
    """Print processing summary."""
    print(f"\n{'='*50}")
    print(f"Summary:")
    print(f"  Kept: {kept}")
    print(f"  Removed: {removed}")
    print(f"  Remaining: {remaining}")
    print(f"{'='*50}")


def main():
    project_root = Path(__file__).parent.parent.parent
    input_file = project_root / 'backend' / 'data' / 'missing_words.txt'
    output_file = project_root / 'backend' / 'data' / 'filtered_words.txt'

    if not input_file.exists():
        print(f"Error: File not found: {input_file}")
        sys.exit(1)

    try:
        filter_words(input_file, output_file)
    except KeyboardInterrupt:
        print("\n\nInterrupted by user. Progress saved.")
        sys.exit(0)


if __name__ == '__main__':
    main()
