#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Round ease_factor and spell_strength to 2 decimal places in the database.
This script updates all existing records to have exactly 2 decimal places.
"""

import sqlite3
import sys
from pathlib import Path

# Add parent directory to path to import config
sys.path.insert(0, str(Path(__file__).parent.parent))

from web_app.config import DB_PATH


def round_decimal_fields():
    """Round ease_factor and spell_strength to 2 decimal places."""
    db_path = DB_PATH

    print(f"Connecting to database: {db_path}")
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    try:
        # Round ease_factor to 2 decimal places
        print("Rounding ease_factor values...")
        cursor.execute("""
            UPDATE words
            SET ease_factor = ROUND(ease_factor, 2)
            WHERE ease_factor IS NOT NULL
        """)
        ease_factor_count = cursor.rowcount
        print(f"Updated {ease_factor_count} ease_factor values")

        # Round spell_strength to 2 decimal places
        print("Rounding spell_strength values...")
        cursor.execute("""
            UPDATE words
            SET spell_strength = ROUND(spell_strength, 2)
            WHERE spell_strength IS NOT NULL
        """)
        spell_strength_count = cursor.rowcount
        print(f"Updated {spell_strength_count} spell_strength values")

        # Commit changes
        conn.commit()
        print("\nSuccessfully rounded all decimal fields to 2 decimal places!")

    except Exception as e:
        conn.rollback()
        print(f"\nError: {e}")
        raise
    finally:
        conn.close()


if __name__ == "__main__":
    round_decimal_fields()
