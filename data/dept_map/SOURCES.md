# Per-department map data: sources and lineage (Oct 22, 2026 SV)
- Department boundaries: geoBoundaries gbOpen SLV ADM1, simplified, pinned commit 9469f09. Source OpenStreetMap, year represented 2021. Licence CC BY-SA 2.0, so it needs attribution on screen or in the README.
- Points: AgroClima src/data/locations.json on main (20 coffee places, each with its own source field).
- Build: `python3 build.py` (needs shapely). It writes departments.geojson and department_points.json with SHA-256 hashes for both inputs. Two runs gave identical outputs.
- Check: all 20 points fall inside the department they list.
- Coverage: 7 of 14 departments have points (Ahuachapán 3, Chalatenango 4, La Libertad 5, Morazán 2, Santa Ana 1, Sonsonate 2, Usulután 3). The other 7 have no point, so the map must show them as no data, never as a risk level.
- Risk per department is not computed here. It comes from the app's Open-Meteo engine run on these points. Captain decision (Oct 22, 10:58 PM SV): each department shows its worst level plus the point count, for example «alto · 3 puntos». The 7 departments with no point use the «sin datos» style. The OpenStreetMap credit goes in the map footer.
