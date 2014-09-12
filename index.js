"use strict";

var url = require("url"),
    util = require("util"),
    zlib = require("zlib");

var merc = new (require("sphericalmercator"))(),
    ProtoBuf = require("protobufjs"),
    pg = require("pg");

var builder = ProtoBuf.loadProtoFile("./proto/vector_tile.proto"),
    mapnik = builder.build("mapnik");

module.exports = function(tilelive) {
  var RasterPBF = function(uri, callback) {
    this.databaseUrl = url.format(uri);

    uri = url.parse(uri, true);

    this.band = (uri.query.band | 0) || 1;
    this.column = uri.query.column || "rast";
    this.table = uri.query.table;

    return setImmediate(callback, null, this);
  };

  RasterPBF.prototype.getTile = function(z, x, y, callback) {
    var band = this.band,
        column = this.column,
        table = this.table;

    return pg.connect(this.databaseUrl, function(err, client, done) {
      if (err) {
        return callback(err);
      }

      var bbox = merc.bbox(x, y, z, false, "900913");

      var query = util.format("SELECT ST_AsTIFF(ST_Clip(ST_Union(%s, %d), ST_SetSRID($1::box2d, 3857)), '') tiff FROM %s WHERE %s && $1::box2d",
                              column,
                              band,
                              table,
                              column);

      return client.query(query,
                          [util.format("BOX(%d %d,%d %d)", bbox[0], bbox[1], bbox[2], bbox[3])],
                          function(err, result) {
        done();

        if (err) {
          return callback(err);
        }

        if (result.rows.length === 0) {
          return callback(new Error("Tile does not exist"));
        }

        var tile = new mapnik.vector.tile({
          layers: [
            {
              name: "raster", // TODO get a name from either the configuration or the url
              features: [
                {
                  raster: result.rows[0].tiff
                }
              ]
            }
          ]
        });

        return zlib.gzip(tile.encode().toBuffer(), function(err, data) {
          if (err) {
            return callback(err);
          }

          return callback(null, data, {
            "Content-Type": "application/x-protobuf",
            "Content-Encoding": "gzip"
          });
        });
      });

    });
  };

  RasterPBF.prototype.getInfo = function(callback) {
    return setImmediate(callback, null, {
      format: "pbf",
      minzoom: 12,
      maxzoom: 18,
      vector_layers: [
        {
          geometry: "raster",
          id: "raster",
          minzoom: 12
        }
      ]
    });
  };

  RasterPBF.prototype.close = function(callback) {
    return callback && setImmediate(callback);
  };
 
  RasterPBF.registerProtocols = function(tilelive) {
    tilelive.protocols["pgraster:"] = RasterPBF;
  };
 
  RasterPBF.registerProtocols(tilelive);
 
  return RasterPBF;
};
