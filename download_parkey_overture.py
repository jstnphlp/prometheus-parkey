
import duckdb

db = duckdb.connect()

db.execute("INSTALL azure; LOAD azure;")
db.execute("INSTALL spatial; LOAD spatial;")
db.execute("SET geometry_always_xy = true;")

db.execute("""
CREATE SECRET overture_public (
    TYPE AZURE,
    PROVIDER CONFIG,
    ACCOUNT_NAME 'overturemapswestus2'
)
""")

print("Downloading Overture parking data from Azure...")

db.execute("""
COPY (
    SELECT
        id,
        names.primary AS name,
        COALESCE(taxonomy.primary, basic_category) AS basic_category,
        confidence,
        geometry
    FROM read_parquet(
        'az://release/2026-10-21.0/theme=places/type=place/*.parquet'
    )
    WHERE bbox.xmin BETWEEN 121.024 AND 121.041
      AND bbox.ymin BETWEEN 14.558 AND 14.572
      AND names.primary IS NOT NULL
      AND (
          COALESCE(taxonomy.primary, basic_category) ILIKE '%parking%'
          OR COALESCE(taxonomy.primary, basic_category) ILIKE '%garage%'
          OR COALESCE(taxonomy.primary, basic_category) ILIKE '%car_park%'
      )
) TO 'poblacion-places.geojson'
WITH (FORMAT GDAL, DRIVER 'GeoJSON')
""")

print("Download completed: poblacion-places.geojson")

