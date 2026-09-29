#!/usr/bin/env python3
"""
Second pass deduplication for remaining duplicates.
Uses broader keys to catch edge cases.
"""

import psycopg2
import sys

DB_URL = "postgresql://neondb_owner:npg_1Pu5tKnkvcpD@ep-orange-pond-awso2777-pooler.c-12.us-east-1.aws.neon.tech/neondb?sslmode=require"

def connect():
    return psycopg2.connect(DB_URL)

def dedup_with_all_cols(cur, table_name):
    """Deduplicate based on all non-id columns."""
    # Get all column names except 'id'
    cur.execute(f"""
        SELECT column_name FROM information_schema.columns
        WHERE table_name = '{table_name}' AND table_schema = 'public'
        AND column_name != 'id'
        ORDER BY ordinal_position
    """)
    cols = [r[0] for r in cur.fetchall()]
    key_str = ", ".join(cols)
    
    cur.execute(f"SELECT COUNT(*) FROM {table_name}")
    before = cur.fetchone()[0]
    
    # Build join conditions
    join_conds = " AND ".join(f"t.{c} = dup.{c}" for c in cols)
    
    # Handle NULL values with IS NOT DISTINCT FROM
    join_conds_null = " AND ".join(
        f"t.{c} IS NOT DISTINCT FROM dup.{c}" for c in cols
    )
    
    delete_sql = f"""
        DELETE FROM {table_name}
        WHERE id IN (
            SELECT t.id
            FROM {table_name} t
            INNER JOIN (
                SELECT {key_str}, MIN(id) as min_id
                FROM {table_name}
                GROUP BY {key_str}
                HAVING COUNT(*) > 1
            ) dup ON {join_conds_null}
            WHERE t.id > dup.min_id
        )
    """
    
    cur.execute(delete_sql)
    deleted = cur.rowcount
    
    cur.execute(f"SELECT COUNT(*) FROM {table_name}")
    after = cur.fetchone()[0]
    
    return before, deleted, after

def main():
    conn = connect()
    conn.autocommit = False
    cur = conn.cursor()
    
    print("=" * 70)
    print("DEPURACIÓN PASADA 2 - Duplicados residuales")
    print("=" * 70)
    print()
    
    tables_to_clean = [
        "errores_records",
        "tiempos_muertos",
        "rendimientos_records",
    ]
    
    total_deleted = 0
    
    try:
        for table in tables_to_clean:
            print(f"🧹 {table} (todos los campos)...")
            before, deleted, after = dedup_with_all_cols(cur, table)
            print(f"   Antes: {before:,} → Eliminados: {deleted:,} → Después: {after:,}")
            total_deleted += deleted
        
        print()
        print("💾 Committing...")
        conn.commit()
        print("✅ Guardado")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        conn.rollback()
        sys.exit(1)
    finally:
        cur.close()
        conn.close()
    
    print(f"\n📊 Total eliminados en pasada 2: {total_deleted:,}")

if __name__ == "__main__":
    main()
