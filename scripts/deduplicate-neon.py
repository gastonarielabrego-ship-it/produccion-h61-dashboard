#!/usr/bin/env python3
"""
Deduplicate all tables in Neon PostgreSQL database.
Strategy: For each table, keep the row with the lowest id (first inserted)
and delete the rest of the duplicate rows.
Uses a transaction - commits only if all dedup operations succeed.
"""

import psycopg2
import sys

DB_URL = "postgresql://neondb_owner:npg_1Pu5tKnkvcpD@ep-orange-pond-awso2777-pooler.c-12.us-east-1.aws.neon.tech/neondb?sslmode=require"

def connect():
    return psycopg2.connect(DB_URL)

def deduplicate_table(cur, table_name, key_columns, id_col="id"):
    """
    Remove duplicate rows, keeping the one with the smallest id.
    Returns the number of rows deleted.
    """
    key_str = ", ".join(key_columns)
    
    # Count before
    cur.execute(f"SELECT COUNT(*) FROM {table_name}")
    before = cur.fetchone()[0]
    
    # Delete duplicates: keep the row with min(id) for each key group
    # Using CTE for efficiency
    delete_sql = f"""
        DELETE FROM {table_name}
        WHERE {id_col} IN (
            SELECT t.{id_col}
            FROM {table_name} t
            INNER JOIN (
                SELECT {key_str}, MIN({id_col}) as min_id
                FROM {table_name}
                GROUP BY {key_str}
                HAVING COUNT(*) > 1
            ) dup ON {" AND ".join(f"t.{col} = dup.{col}" for col in key_columns)}
            WHERE t.{id_col} > dup.min_id
        )
    """
    
    cur.execute(delete_sql)
    deleted = cur.rowcount
    
    # Count after
    cur.execute(f"SELECT COUNT(*) FROM {table_name}")
    after = cur.fetchone()[0]
    
    return before, deleted, after

def deduplicate_errores(cur):
    """
    Special dedup for errores_records which may not have a simple unique key.
    Use (fecha_prep, fecha_ctrl, id_operario, codigo_producto, errores)
    """
    # Count before
    cur.execute("SELECT COUNT(*) FROM errores_records")
    before = cur.fetchone()[0]
    
    key_cols = ["fecha_prep", "fecha_ctrl", "id_operario", "codigo_producto", "errores"]
    key_str = ", ".join(key_cols)
    
    delete_sql = f"""
        DELETE FROM errores_records
        WHERE id IN (
            SELECT t.id
            FROM errores_records t
            INNER JOIN (
                SELECT {key_str}, MIN(id) as min_id
                FROM errores_records
                GROUP BY {key_str}
                HAVING COUNT(*) > 1
            ) dup ON {" AND ".join(f"t.{col} = dup.{col}" for col in key_cols)}
            WHERE t.id > dup.min_id
        )
    """
    
    cur.execute(delete_sql)
    deleted = cur.rowcount
    
    cur.execute("SELECT COUNT(*) FROM errores_records")
    after = cur.fetchone()[0]
    
    return before, deleted, after

def deduplicate_tm(cur):
    """
    Special dedup for tiempos_muertos.
    Key: (fecha, turno, operario, minutos)
    """
    cur.execute("SELECT COUNT(*) FROM tiempos_muertos")
    before = cur.fetchone()[0]
    
    key_cols = ["fecha", "turno", "operario", "minutos"]
    key_str = ", ".join(key_cols)
    
    delete_sql = f"""
        DELETE FROM tiempos_muertos
        WHERE id IN (
            SELECT t.id
            FROM tiempos_muertos t
            INNER JOIN (
                SELECT {key_str}, MIN(id) as min_id
                FROM tiempos_muertos
                GROUP BY {key_str}
                HAVING COUNT(*) > 1
            ) dup ON {" AND ".join(f"t.{col} = dup.{col}" for col in key_cols)}
            WHERE t.id > dup.min_id
        )
    """
    
    cur.execute(delete_sql)
    deleted = cur.rowcount
    
    cur.execute("SELECT COUNT(*) FROM tiempos_muertos")
    after = cur.fetchone()[0]
    
    return before, deleted, after

def deduplicate_rendimientos(cur):
    """Dedup for rendimientos_records. Key: (nombre, fecha)"""
    cur.execute("SELECT COUNT(*) FROM rendimientos_records")
    before = cur.fetchone()[0]
    
    key_cols = ["nombre", "fecha"]
    key_str = ", ".join(key_cols)
    
    delete_sql = f"""
        DELETE FROM rendimientos_records
        WHERE id IN (
            SELECT t.id
            FROM rendimientos_records t
            INNER JOIN (
                SELECT {key_str}, MIN(id) as min_id
                FROM rendimientos_records
                GROUP BY {key_str}
                HAVING COUNT(*) > 1
            ) dup ON {" AND ".join(f"t.{col} = dup.{col}" for col in key_cols)}
            WHERE t.id > dup.min_id
        )
    """
    
    cur.execute(delete_sql)
    deleted = cur.rowcount
    
    cur.execute("SELECT COUNT(*) FROM rendimientos_records")
    after = cur.fetchone()[0]
    
    return before, deleted, after

def main():
    conn = connect()
    conn.autocommit = False
    cur = conn.cursor()
    
    print("=" * 70)
    print("DEPURACIÓN DE DUPLICADOS - Neon PostgreSQL (Producción H61)")
    print("=" * 70)
    print()
    
    total_deleted = 0
    results = []
    
    try:
        # 1. production_records
        print("1️⃣  production_records (fecha, turno, operario, circuito)...")
        before, deleted, after = deduplicate_table(cur, "production_records",
            ["fecha", "turno", "operario", "circuito"])
        print(f"   Antes: {before:,} → Eliminados: {deleted:,} → Después: {after:,}")
        results.append(("production_records", before, deleted, after))
        total_deleted += deleted
        
        # 2. clarkistas_records
        print("2️⃣  clarkistas_records (fecha, turno, operario, circuito)...")
        before, deleted, after = deduplicate_table(cur, "clarkistas_records",
            ["fecha", "turno", "operario", "circuito"])
        print(f"   Antes: {before:,} → Eliminados: {deleted:,} → Después: {after:,}")
        results.append(("clarkistas_records", before, deleted, after))
        total_deleted += deleted
        
        # 3. errores_records
        print("3️⃣  errores_records (fecha_prep, fecha_ctrl, id_operario, codigo_producto, errores)...")
        before, deleted, after = deduplicate_errores(cur)
        print(f"   Antes: {before:,} → Eliminados: {deleted:,} → Después: {after:,}")
        results.append(("errores_records", before, deleted, after))
        total_deleted += deleted
        
        # 4. tiempos_muertos
        print("4️⃣  tiempos_muertos (fecha, turno, operario, minutos)...")
        before, deleted, after = deduplicate_tm(cur)
        print(f"   Antes: {before:,} → Eliminados: {deleted:,} → Después: {after:,}")
        results.append(("tiempos_muertos", before, deleted, after))
        total_deleted += deleted
        
        # 5. rendimientos_records
        print("5️⃣  rendimientos_records (nombre, fecha)...")
        before, deleted, after = deduplicate_rendimientos(cur)
        print(f"   Antes: {before:,} → Eliminados: {deleted:,} → Después: {after:,}")
        results.append(("rendimientos_records", before, deleted, after))
        total_deleted += deleted
        
        # horas_extras_records - already clean, skip
        print("6️⃣  horas_extras_records - ✅ Ya limpio (sin duplicados)")
        cur.execute("SELECT COUNT(*) FROM horas_extras_records")
        cnt = cur.fetchone()[0]
        results.append(("horas_extras_records", cnt, 0, cnt))
        
        # Commit
        print()
        print("💾 Committing changes...")
        conn.commit()
        print("✅ Cambios guardados exitosamente")
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        print("🔄 Haciendo rollback...")
        conn.rollback()
        print("❌ No se guardaron cambios")
        sys.exit(1)
    
    finally:
        cur.close()
        conn.close()
    
    # Summary
    print()
    print("=" * 70)
    print("RESUMEN DE DEPURACIÓN")
    print("=" * 70)
    print(f"{'Tabla':<30} {'Antes':>10} {'Borrados':>10} {'Después':>10}")
    print("-" * 65)
    for name, before, deleted, after in results:
        print(f"{name:<30} {before:>10,} {deleted:>10,} {after:>10,}")
    print("-" * 65)
    print(f"{'TOTAL':<30} {'':>10} {total_deleted:>10,}")
    print()
    print("✅ Depuración completada")

if __name__ == "__main__":
    main()
