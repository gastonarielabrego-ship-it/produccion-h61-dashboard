#!/usr/bin/env python3
"""
Analyze Neon database for duplicate records in production tables.
Connects directly to Neon PostgreSQL and checks each table.
"""

import psycopg2
import json
from collections import defaultdict

DB_URL = "postgresql://neondb_owner:npg_1Pu5tKnkvcpD@ep-orange-pond-awso2777-pooler.c-12.us-east-1.aws.neon.tech/neondb?sslmode=require"

def connect():
    return psycopg2.connect(DB_URL)

def analyze_table(cur, table_name, key_columns):
    """Check for duplicates based on key columns."""
    key_str = ", ".join(key_columns)
    
    # Total records
    cur.execute(f"SELECT COUNT(*) FROM {table_name}")
    total = cur.fetchone()[0]
    
    # Distinct records by key
    cur.execute(f"SELECT COUNT(DISTINCT ({key_str})) FROM {table_name}")
    distinct = cur.fetchone()[0]
    
    duplicates = total - distinct
    
    # Get duplicate groups
    cur.execute(f"""
        SELECT {key_str}, COUNT(*) as cnt
        FROM {table_name}
        GROUP BY {key_str}
        HAVING COUNT(*) > 1
        ORDER BY cnt DESC
        LIMIT 20
    """)
    dup_groups = cur.fetchall()
    
    # Total duplicate rows (rows beyond the first in each group)
    cur.execute(f"""
        SELECT SUM(cnt - 1) FROM (
            SELECT COUNT(*) as cnt
            FROM {table_name}
            GROUP BY {key_str}
            HAVING COUNT(*) > 1
        ) sub
    """)
    dup_rows = cur.fetchone()[0] or 0
    
    return {
        "table": table_name,
        "total": total,
        "distinct": distinct,
        "duplicate_groups": duplicates,
        "duplicate_rows": dup_rows,
        "top_duplicates": [{"key": g[:-1], "count": g[-1]} for g in dup_groups]
    }

def main():
    conn = connect()
    cur = conn.cursor()
    
    print("=" * 70)
    print("ANÁLISIS DE DUPLICADOS - BASE DE DATOS NEON (Producción H61)")
    print("=" * 70)
    
    # 1. List all tables and row counts
    print("\n📊 RESUMEN DE TABLAS:")
    print("-" * 50)
    cur.execute("""
        SELECT tablename FROM pg_tables 
        WHERE schemaname = 'public' 
        ORDER BY tablename
    """)
    tables = [r[0] for r in cur.fetchall()]
    
    for t in tables:
        cur.execute(f"SELECT COUNT(*) FROM {t}")
        cnt = cur.fetchone()[0]
        print(f"  {t:35s} {cnt:>10,} registros")
    
    # 2. Analyze production_records
    print("\n" + "=" * 70)
    print("🔍 production_records - DUPLICADOS POR (fecha, turno, operario, circuito)")
    print("-" * 50)
    result = analyze_table(cur, "production_records", 
        ["fecha", "turno", "operario", "circuito"])
    print(f"  Total registros:       {result['total']:>10,}")
    print(f"  Registros únicos:      {result['distinct']:>10,}")
    print(f"  Grupos duplicados:     {result['duplicate_groups']:>10,}")
    print(f"  Filas duplicadas:      {result['duplicate_rows']:>10,}")
    if result['top_duplicates']:
        print(f"\n  Top duplicados:")
        for d in result['top_duplicates'][:10]:
            print(f"    {d['key']} → {d['count']}x")
    
    # 3. More detailed duplicate check for production_records - exact row dup
    print("\n🔍 production_records - DUPLICADOS EXACTOS (todos los campos de datos)")
    print("-" * 50)
    cur.execute("""
        SELECT fecha, turno, operario, circuito, funcion, total, 
               hora_00, hora_01, hora_06, hora_07, hora_08,
               COUNT(*) as cnt
        FROM production_records
        GROUP BY fecha, turno, operario, circuito, funcion, total,
                 hora_00, hora_01, hora_06, hora_07, hora_08
        HAVING COUNT(*) > 1
        ORDER BY cnt DESC
        LIMIT 15
    """)
    exact_dups = cur.fetchall()
    if exact_dups:
        print(f"  Grupos con filas exactas duplicadas: {len(exact_dups)}")
        for d in exact_dups[:10]:
            print(f"    fecha={d[0]}, turno={d[1]}, operario={d[2]}, circuito={d[3]}, total={d[5]} → {d[-1]}x")
    else:
        print("  ✅ No hay filas exactas duplicadas")
    
    # 4. Check for same operario appearing multiple times per date/turno/circuito
    print("\n🔍 production_records - OPERARIOS REPETIDOS POR (fecha, turno, circuito)")
    print("-" * 50)
    cur.execute("""
        SELECT fecha, turno, circuito, operario, COUNT(*) as cnt
        FROM production_records
        GROUP BY fecha, turno, circuito, operario
        HAVING COUNT(*) > 1
        ORDER BY cnt DESC
        LIMIT 20
    """)
    op_dups = cur.fetchall()
    if op_dups:
        total_dup_groups = len(op_dups)
        cur.execute("""
            SELECT SUM(cnt - 1) FROM (
                SELECT COUNT(*) as cnt
                FROM production_records
                GROUP BY fecha, turno, circuito, operario
                HAVING COUNT(*) > 1
            ) sub
        """)
        dup_rows = cur.fetchone()[0] or 0
        print(f"  Grupos: {total_dup_groups}, Filas extra: {dup_rows}")
        print(f"\n  Top 15:")
        for d in op_dups[:15]:
            print(f"    {d[0]}/{d[1]}/{d[2]} operario={d[3]} → {d[4]}x")
    else:
        print("  ✅ No hay operarios repetidos por fecha/turno/circuito")
    
    # 5. Check date ranges
    print("\n📅 RANGO DE FECHAS EN production_records:")
    print("-" * 50)
    cur.execute("SELECT MIN(fecha), MAX(fecha), COUNT(DISTINCT fecha) FROM production_records")
    min_d, max_d, n_dates = cur.fetchone()
    print(f"  Desde: {min_d}  Hasta: {max_d}  ({n_dates} fechas distintas)")
    
    # Records per month
    print("\n  Registros por mes:")
    cur.execute("""
        SELECT (fecha / 100) as year_month, COUNT(*) as cnt, 
               COUNT(DISTINCT fecha) as days
        FROM production_records
        GROUP BY (fecha / 100)
        ORDER BY year_month
    """)
    for row in cur.fetchall():
        ym = str(row[0])
        print(f"    {ym[:4]}-{ym[4:]}: {row[1]:>8,} registros en {row[2]} días")
    
    # 6. Analyze clarkistas_records
    print("\n" + "=" * 70)
    print("🔍 clarkistas_records - DUPLICADOS")
    print("-" * 50)
    result = analyze_table(cur, "clarkistas_records", 
        ["fecha", "turno", "operario", "circuito"])
    print(f"  Total registros:       {result['total']:>10,}")
    print(f"  Registros únicos:      {result['distinct']:>10,}")
    print(f"  Grupos duplicados:     {result['duplicate_groups']:>10,}")
    print(f"  Filas duplicadas:      {result['duplicate_rows']:>10,}")
    if result['top_duplicates'][:5]:
        for d in result['top_duplicates'][:5]:
            print(f"    {d['key']} → {d['count']}x")
    
    # 7. Analyze errores_records
    print("\n🔍 errores_records - DUPLICADOS")
    print("-" * 50)
    result = analyze_table(cur, "errores_records",
        ["fecha_prep", "id_operario", "codigo_producto"])
    print(f"  Total registros:       {result['total']:>10,}")
    print(f"  Registros únicos:      {result['distinct']:>10,}")
    print(f"  Grupos duplicados:     {result['duplicate_groups']:>10,}")
    print(f"  Filas duplicadas:      {result['duplicate_rows']:>10,}")
    
    # 8. Analyze tiempos_muertos
    print("\n🔍 tiempos_muertos - DUPLICADOS")
    print("-" * 50)
    result = analyze_table(cur, "tiempos_muertos",
        ["fecha", "operario", "minutos"])
    print(f"  Total registros:       {result['total']:>10,}")
    print(f"  Registros únicos:      {result['distinct']:>10,}")
    print(f"  Grupos duplicados:     {result['duplicate_groups']:>10,}")
    print(f"  Filas duplicadas:      {result['duplicate_rows']:>10,}")
    
    # 9. Analyze horas_extras_records
    print("\n🔍 horas_extras_records - DUPLICADOS")
    print("-" * 50)
    result = analyze_table(cur, "horas_extras_records",
        ["fecha", "cod_empleado", "hs_trabajadas"])
    print(f"  Total registros:       {result['total']:>10,}")
    print(f"  Registros únicos:      {result['distinct']:>10,}")
    print(f"  Grupos duplicados:     {result['duplicate_groups']:>10,}")
    print(f"  Filas duplicadas:      {result['duplicate_rows']:>10,}")
    
    # 10. Analyze rendimientos_records
    print("\n🔍 rendimientos_records - DUPLICADOS")
    print("-" * 50)
    try:
        result = analyze_table(cur, "rendimientos_records",
            ["nombre", "fecha"])
        print(f"  Total registros:       {result['total']:>10,}")
        print(f"  Registros únicos:      {result['distinct']:>10,}")
        print(f"  Grupos duplicados:     {result['duplicate_groups']:>10,}")
        print(f"  Filas duplicadas:      {result['duplicate_rows']:>10,}")
    except Exception as e:
        print(f"  Error: {e}")
    
    cur.close()
    conn.close()
    
    print("\n" + "=" * 70)
    print("ANÁLISIS COMPLETADO")
    print("=" * 70)

if __name__ == "__main__":
    main()
