#!/usr/bin/env python3
"""
Database Introspection Script

Extracts schema information directly from Supabase PostgreSQL,
outputting both JSON and Markdown documentation.

Usage:
    python -m scripts.introspect_database [--output-dir DIR]
"""

import os
import json
import argparse
from datetime import datetime
from dotenv import load_dotenv
from sqlalchemy import create_engine, text

# Load environment variables
load_dotenv()


def get_connection():
    """Create database connection from environment."""
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        raise ValueError("DATABASE_URL environment variable not set")
    return create_engine(database_url)


def query_tables(engine) -> list[dict]:
    """Query all user tables."""
    sql = text("""
        SELECT
            t.table_name,
            obj_description((quote_ident(t.table_schema) || '.' || quote_ident(t.table_name))::regclass) as comment
        FROM information_schema.tables t
        WHERE t.table_schema = 'public'
        AND t.table_type = 'BASE TABLE'
        ORDER BY t.table_name
    """)
    with engine.connect() as conn:
        result = conn.execute(sql)
        return [{"name": row[0], "comment": row[1]} for row in result]


def query_columns(engine, table_name: str) -> list[dict]:
    """Query columns for a specific table."""
    sql = text("""
        SELECT
            c.column_name,
            c.data_type,
            c.udt_name,
            c.is_nullable,
            c.column_default,
            c.character_maximum_length,
            c.numeric_precision,
            c.numeric_scale
        FROM information_schema.columns c
        WHERE c.table_schema = 'public'
        AND c.table_name = :table_name
        ORDER BY c.ordinal_position
    """)
    with engine.connect() as conn:
        result = conn.execute(sql, {"table_name": table_name})
        columns = []
        for row in result:
            col = {
                "name": row[0],
                "data_type": row[1],
                "udt_name": row[2],
                "nullable": row[3] == "YES",
                "default": row[4],
            }
            if row[5]:  # character_maximum_length
                col["max_length"] = row[5]
            if row[6]:  # numeric_precision
                col["precision"] = row[6]
                if row[7]:  # numeric_scale
                    col["scale"] = row[7]
            columns.append(col)
        return columns


def query_constraints(engine, table_name: str) -> list[dict]:
    """Query constraints for a specific table."""
    sql = text("""
        SELECT
            tc.constraint_name,
            tc.constraint_type,
            kcu.column_name,
            ccu.table_name AS foreign_table,
            ccu.column_name AS foreign_column
        FROM information_schema.table_constraints tc
        LEFT JOIN information_schema.key_column_usage kcu
            ON tc.constraint_name = kcu.constraint_name
            AND tc.table_schema = kcu.table_schema
        LEFT JOIN information_schema.constraint_column_usage ccu
            ON tc.constraint_name = ccu.constraint_name
            AND tc.table_schema = ccu.table_schema
        WHERE tc.table_schema = 'public'
        AND tc.table_name = :table_name
        ORDER BY tc.constraint_name, kcu.ordinal_position
    """)
    with engine.connect() as conn:
        result = conn.execute(sql, {"table_name": table_name})
        constraints = {}
        for row in result:
            name = row[0]
            if name not in constraints:
                constraints[name] = {
                    "name": name,
                    "type": row[1],
                    "columns": [],
                }
                if row[1] == "FOREIGN KEY" and row[3]:
                    constraints[name]["references"] = {
                        "table": row[3],
                        "column": row[4]
                    }
            if row[2]:
                constraints[name]["columns"].append(row[2])
        return list(constraints.values())


def query_indexes(engine, table_name: str) -> list[dict]:
    """Query indexes for a specific table."""
    sql = text("""
        SELECT
            indexname,
            indexdef
        FROM pg_indexes
        WHERE schemaname = 'public'
        AND tablename = :table_name
        ORDER BY indexname
    """)
    with engine.connect() as conn:
        result = conn.execute(sql, {"table_name": table_name})
        return [{"name": row[0], "definition": row[1]} for row in result]


def query_views(engine) -> list[dict]:
    """Query all views."""
    sql = text("""
        SELECT
            v.table_name,
            v.view_definition
        FROM information_schema.views v
        WHERE v.table_schema = 'public'
        ORDER BY v.table_name
    """)
    with engine.connect() as conn:
        result = conn.execute(sql)
        return [{"name": row[0], "definition": row[1]} for row in result]


def query_rls_policies(engine) -> list[dict]:
    """Query RLS policies."""
    sql = text("""
        SELECT
            schemaname,
            tablename,
            policyname,
            permissive,
            roles,
            cmd,
            qual,
            with_check
        FROM pg_policies
        WHERE schemaname = 'public'
        ORDER BY tablename, policyname
    """)
    with engine.connect() as conn:
        result = conn.execute(sql)
        policies = []
        for row in result:
            policies.append({
                "table": row[1],
                "name": row[2],
                "permissive": row[3] == "PERMISSIVE",
                "roles": list(row[4]) if row[4] else [],
                "command": row[5],
                "using": row[6],
                "with_check": row[7]
            })
        return policies


def query_triggers(engine) -> list[dict]:
    """Query triggers."""
    sql = text("""
        SELECT
            trigger_name,
            event_manipulation,
            event_object_table,
            action_statement,
            action_timing
        FROM information_schema.triggers
        WHERE trigger_schema = 'public'
        ORDER BY event_object_table, trigger_name
    """)
    with engine.connect() as conn:
        result = conn.execute(sql)
        return [{
            "name": row[0],
            "event": row[1],
            "table": row[2],
            "statement": row[3],
            "timing": row[4]
        } for row in result]


def query_functions(engine) -> list[dict]:
    """Query user-defined functions (excluding system functions)."""
    sql = text("""
        SELECT
            p.proname as function_name,
            pg_get_function_result(p.oid) as return_type,
            pg_get_function_arguments(p.oid) as arguments
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
        ORDER BY p.proname
    """)
    with engine.connect() as conn:
        result = conn.execute(sql)
        return [{
            "name": row[0],
            "return_type": row[1],
            "arguments": row[2]
        } for row in result]


def scan_edge_functions() -> list[dict]:
    """Scan Edge Functions from supabase/functions directory."""
    functions_dir = os.path.join(os.path.dirname(__file__), "..", "supabase", "functions")
    functions = []

    if os.path.exists(functions_dir):
        for name in os.listdir(functions_dir):
            func_path = os.path.join(functions_dir, name)
            if os.path.isdir(func_path):
                index_file = os.path.join(func_path, "index.ts")
                if os.path.exists(index_file):
                    # Extract description from first comment block
                    description = ""
                    with open(index_file, "r") as f:
                        content = f.read()
                        if content.startswith("/**"):
                            end = content.find("*/")
                            if end > 0:
                                description = content[3:end].strip()
                                # Clean up the description
                                lines = [line.strip().lstrip("* ") for line in description.split("\n")]
                                description = " ".join(line for line in lines if line)

                    functions.append({
                        "name": name,
                        "description": description[:200] if description else ""
                    })

    return functions


def generate_markdown(schema: dict) -> str:
    """Generate Markdown documentation from schema."""
    lines = [
        "# Database Schema",
        "",
        f"*Generated: {schema['generated_at']}*",
        "",
    ]

    # Tables section
    lines.extend([
        "## Tables",
        "",
        f"Total: {len(schema['tables'])} tables",
        "",
    ])

    for table in schema["tables"]:
        lines.append(f"### {table['name']}")
        lines.append("")

        if table.get("comment"):
            lines.append(f"*{table['comment']}*")
            lines.append("")

        # Columns table
        lines.append("| Column | Type | Nullable | Default |")
        lines.append("|--------|------|----------|---------|")
        for col in table["columns"]:
            type_str = col["udt_name"]
            if col.get("max_length"):
                type_str += f"({col['max_length']})"
            nullable = "YES" if col["nullable"] else "NO"
            default = col["default"] or "-"
            if len(default) > 30:
                default = default[:27] + "..."
            lines.append(f"| {col['name']} | {type_str} | {nullable} | {default} |")
        lines.append("")

        # Constraints
        if table["constraints"]:
            lines.append("**Constraints:**")
            for c in table["constraints"]:
                if c["type"] == "PRIMARY KEY":
                    lines.append(f"- PK: `{', '.join(c['columns'])}`")
                elif c["type"] == "UNIQUE":
                    lines.append(f"- UNIQUE: `{', '.join(c['columns'])}` ({c['name']})")
                elif c["type"] == "FOREIGN KEY":
                    ref = c.get("references", {})
                    lines.append(f"- FK: `{', '.join(c['columns'])}` → `{ref.get('table')}.{ref.get('column')}`")
            lines.append("")

        # Indexes
        if table["indexes"]:
            lines.append("**Indexes:**")
            for idx in table["indexes"]:
                lines.append(f"- `{idx['name']}`")
            lines.append("")

    # Views section
    lines.extend([
        "## Views",
        "",
        f"Total: {len(schema['views'])} views",
        "",
    ])

    for view in schema["views"]:
        lines.append(f"### {view['name']}")
        lines.append("")
        lines.append("```sql")
        # Format view definition for readability
        definition = view["definition"]
        if definition:
            lines.append(definition.strip())
        lines.append("```")
        lines.append("")

    # Edge Functions section
    if schema.get("edge_functions"):
        lines.extend([
            "## Edge Functions",
            "",
            f"Total: {len(schema['edge_functions'])} functions",
            "",
        ])
        for func in schema["edge_functions"]:
            desc = func.get("description", "")
            lines.append(f"- **{func['name']}**: {desc[:100]}..." if len(desc) > 100 else f"- **{func['name']}**: {desc}")
        lines.append("")

    # Storage section
    lines.extend([
        "## Storage Buckets",
        "",
        "- **speaking-audios**: Audio recordings for speaking practice",
        "",
    ])

    # RLS Policies section
    if schema.get("rls_policies"):
        lines.extend([
            "## RLS Policies",
            "",
            f"Total: {len(schema['rls_policies'])} policies",
            "",
        ])
        for policy in schema["rls_policies"]:
            lines.append(f"- **{policy['table']}.{policy['name']}**: {policy['command']}")
        lines.append("")

    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser(description="Introspect Supabase database schema")
    parser.add_argument("--output-dir", default="docs", help="Output directory for generated files")
    args = parser.parse_args()

    print("Connecting to database...")
    engine = get_connection()

    print("Querying tables...")
    tables = query_tables(engine)

    # Enrich tables with columns, constraints, indexes
    for table in tables:
        table["columns"] = query_columns(engine, table["name"])
        table["constraints"] = query_constraints(engine, table["name"])
        table["indexes"] = query_indexes(engine, table["name"])

    print(f"Found {len(tables)} tables")

    print("Querying views...")
    views = query_views(engine)
    print(f"Found {len(views)} views")

    print("Querying RLS policies...")
    rls_policies = query_rls_policies(engine)
    print(f"Found {len(rls_policies)} RLS policies")

    print("Querying triggers...")
    triggers = query_triggers(engine)
    print(f"Found {len(triggers)} triggers")

    print("Querying functions...")
    functions = query_functions(engine)
    print(f"Found {len(functions)} functions")

    print("Scanning Edge Functions...")
    edge_functions = scan_edge_functions()
    print(f"Found {len(edge_functions)} Edge Functions")

    # Build schema object
    schema = {
        "generated_at": datetime.now().isoformat(),
        "tables": tables,
        "views": views,
        "rls_policies": rls_policies,
        "triggers": triggers,
        "functions": functions,
        "edge_functions": edge_functions,
    }

    # Ensure output directory exists
    os.makedirs(args.output_dir, exist_ok=True)

    # Write JSON output
    json_path = os.path.join(args.output_dir, "database-schema.json")
    with open(json_path, "w") as f:
        json.dump(schema, f, indent=2, default=str)
    print(f"Written: {json_path}")

    # Write Markdown output
    md_path = os.path.join(args.output_dir, "database-schema.md")
    markdown = generate_markdown(schema)
    with open(md_path, "w") as f:
        f.write(markdown)
    print(f"Written: {md_path}")

    print("Done!")


if __name__ == "__main__":
    main()
