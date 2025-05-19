# SUMO Network Setup & Conversion Workflow

This project uses **SUMO** (Simulation of Urban Mobility) to convert OpenStreetMap (OSM) data into a clean simulation-ready network, and then into **GeoJSON** for further use.

## 📦 Virtual Environment Setup

1. **Create and activate a Python virtual environment:**
    
    ```bash
    python -m venv venv
    # Windows
    .\venv\Scripts\activate
    # macOS/Linux
    source venv/bin/activate
    ```
    
2. **Install dependencies:**
    
    ```bash
    pip install -r requirements.txt
    ```
    

* * *

## 🛠 Install SUMO

Follow the official guide to install SUMO on your system:  
🔗 [https://sumo.dlr.de/docs/Installing/index.html](https://sumo.dlr.de/docs/Installing/index.html)

> SUMO includes tools like `netconvert` and `netedit` used in this workflow.

* * *

## 🌐 Convert OSM to SUMO Network (XML)

Use `netconvert` to convert an `.osm` file to a SUMO network `.net.xml` file:

```bash
netconvert \
  --osm-files temp/osm/opti.osm \
  --output-file temp/xml/map.net.xml \
  --geometry.remove \
  --roundabouts.guess \
  --junctions.join \
  --tls.guess-signals \
  --ramps.guess \
  --crossings.guess \
  --walkingareas \
  --remove-edges.isolated
```

* * *

## ✏️ Edit the Network (Optional)

Use `netedit.exe` to manually clean or edit the generated network:

1. Find `netedit.exe` using PowerShell:
    
    ```powershell
    Get-Command sumo
    ```
    
    Navigate to the `eclipse/sumo/bin` folder and open `netedit.exe`.
    
2. Load the `map.net.xml` file and remove unnecessary streets.
    

* * *

## 🧭 Set SUMO Environment Variable (Windows)

In PowerShell:

```powershell
$env:SUMO_HOME = "C:\Program Files (x86)\Eclipse\Sumo"
```

* * *

## 🌍 Convert SUMO Network to GeoJSON

After cleaning the network, convert it to a GeoJSON file:

```bash
python "$env:SUMO_HOME/tools/net/net2geojson.py" `
  -n temp/xml/cleanmap.net.xml `
  -o temp/geojson/map.geojson `
  --lanes `
  --internal
```

* * *

## 🧹 Optional: Simplify OSM

For better pre-processing of OSM files, check out the TSMM tool:  
🔗 [https://github.com/TSMM-DM/TSMM](https://github.com/TSMM-DM/TSMM)