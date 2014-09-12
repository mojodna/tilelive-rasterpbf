# tilelive-rasterpbf

I am a tilelive source for outputting PBF-encoded rasters from PostGIS.

## Usage

```bash
tessera -r tilelive-rasterpbf "pgraster:///ned?table=ned&band=1&column=rast"
```

(`band=1` and `column=rast` represent default values.)

Nothing currently understands the data produced by this module.
