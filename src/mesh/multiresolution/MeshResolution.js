define([
  'misc/Utils',
  'editor/Subdivision',
  'mesh/Mesh'
], function (Utils, Subdivision, Mesh) {

  'use strict';

  var MeshResolution = function (transformData, render, mesh) {
    this.meshOrigin_ = mesh || new Mesh();
    this.meshOrigin_.setTransformData(transformData);
    this.meshOrigin_.setRender(render);
    this.detailsXYZ_ = null; // details vectors (Float32Array)
    this.detailsRGB_ = null; // details vectors (Float32Array)
  };

  MeshResolution.prototype = {
    getMeshOrigin: function () {
      return this.meshOrigin_;
    },
    getDetailsVertices: function () {
      return this.detailsXYZ_;
    },
    getDetailsColors: function () {
      return this.detailsRGB_;
    },
    setDetailsVertices: function (dAr) {
      this.detailsXYZ_ = dAr;
    },
    setDetailsColors: function (dcAr) {
      this.detailsRGB_ = dcAr;
    },
    /** Go to one level above (down to up) */
    higherSynthesis: function (meshDown) {
      Subdivision.partialSubdivision(meshDown, this.getVertices(), this.getColors());
      this.applyDetails();
    },
    /** Go to one level below (up to down) */
    lowerAnalysis: function (meshUp) {
      this.getVertices().set(meshUp.getVertices().subarray(0, this.getNbVertices() * 3));
      this.getColors().set(meshUp.getColors().subarray(0, this.getNbVertices() * 3));
      var subdVerts = new Float32Array(meshUp.getNbVertices() * 3);
      var subdColors = new Float32Array(meshUp.getNbVertices() * 3);
      Subdivision.partialSubdivision(this, subdVerts, subdColors);
      meshUp.computeDetails(subdVerts, subdColors);
    },
    /** Apply back the detail vectors */
    applyDetails: function () {
      var vrrStartCountUp = this.getVerticesRingVertStartCount();
      var vertRingVertUp = this.getVerticesRingVert();
      var vArUp = this.getVertices();
      var nArUp = this.getNormals();
      var cArUp = this.getColors();
      var nbVertsUp = this.getNbVertices();

      var vArOut = new Float32Array(vArUp.length);
      var dAr = this.getDetailsVertices();
      var dColorAr = this.getDetailsColors();

      for (var i = 0; i < nbVertsUp; ++i) {
        var j = i * 3;

        // vertex coord
        var vx = vArUp[j];
        var vy = vArUp[j + 1];
        var vz = vArUp[j + 2];

        // normal vec
        var nx = nArUp[j];
        var ny = nArUp[j + 1];
        var nz = nArUp[j + 2];
        // normalize vector
        var len = 1.0 / Math.sqrt(nx * nx + ny * ny + nz * nz);
        nx *= len;
        ny *= len;
        nz *= len;

        // tangent vec (vertex neighbor - vertex)
        var k = vertRingVertUp[vrrStartCountUp[i * 2]] * 3;
        var tx = vArUp[k] - vx;
        var ty = vArUp[k + 1] - vy;
        var tz = vArUp[k + 2] - vz;
        // distance to normal plane
        len = tx * nx + ty * ny + tz * nz;
        // project on normal plane
        tx -= nx * len;
        ty -= ny * len;
        tz -= nz * len;
        // normalize vector
        len = 1.0 / Math.sqrt(tx * tx + ty * ty + tz * tz);
        tx *= len;
        ty *= len;
        tz *= len;

        // bi normal/tangent
        var bix = ny * tz - nz * ty;
        var biy = nz * tx - nx * tz;
        var biz = nx * ty - ny * tx;

        // displacement/detail vector (object space)
        var dx = dAr[j];
        var dy = dAr[j + 1];
        var dz = dAr[j + 2];

        // detail vec in the local frame
        vArOut[j] = vx + nx * dx + tx * dy + bix * dz;
        vArOut[j + 1] = vy + ny * dx + ty * dy + biy * dz;
        vArOut[j + 2] = vz + nz * dx + tz * dy + biz * dz;

        cArUp[j] += dColorAr[j];
        cArUp[j + 1] += dColorAr[j + 1];
        cArUp[j + 2] += dColorAr[j + 2];
      }
      this.setVertices(vArOut);
    },
    /** Compute the detail vectors */
    computeDetails: function (subdVerts, subdColors) {
      var vrrStartCountUp = this.getVerticesRingVertStartCount();
      var vertRingVertUp = this.getVerticesRingVert();
      var vArUp = this.getVertices();
      var nArUp = this.getNormals();
      var cArUp = this.getColors();
      var nbVertices = this.getNbVertices();

      var dAr = new Float32Array(subdVerts.length);
      this.setDetailsVertices(dAr);
      var dColorAr = new Float32Array(subdVerts.length);
      this.setDetailsColors(dColorAr);

      for (var i = 0; i < nbVertices; ++i) {
        var j = i * 3;

        // normal vec
        var nx = nArUp[j];
        var ny = nArUp[j + 1];
        var nz = nArUp[j + 2];
        // normalize vector
        var len = 1.0 / Math.sqrt(nx * nx + ny * ny + nz * nz);
        nx *= len;
        ny *= len;
        nz *= len;

        // tangent vec (vertex neighbor - vertex)
        var k = vertRingVertUp[vrrStartCountUp[i * 2]] * 3;
        var tx = subdVerts[k] - subdVerts[j];
        var ty = subdVerts[k + 1] - subdVerts[j + 1];
        var tz = subdVerts[k + 2] - subdVerts[j + 2];
        // distance to normal plane
        len = tx * nx + ty * ny + tz * nz;
        // project on normal plane
        tx -= nx * len;
        ty -= ny * len;
        tz -= nz * len;
        // normalize vector
        len = 1.0 / Math.sqrt(tx * tx + ty * ty + tz * tz);
        tx *= len;
        ty *= len;
        tz *= len;

        // bi normal/tangent
        var bix = ny * tz - nz * ty;
        var biy = nz * tx - nx * tz;
        var biz = nx * ty - ny * tx;

        // displacement/detail vector (object space)
        var dx = vArUp[j] - subdVerts[j];
        var dy = vArUp[j + 1] - subdVerts[j + 1];
        var dz = vArUp[j + 2] - subdVerts[j + 2];

        // order : n/t/bi
        dAr[j] = nx * dx + ny * dy + nz * dz;
        dAr[j + 1] = tx * dx + ty * dy + tz * dz;
        dAr[j + 2] = bix * dx + biy * dy + biz * dz;

        dColorAr[j] = cArUp[j] - subdColors[j];
        dColorAr[j + 1] = cArUp[j + 1] - subdColors[j + 1];
        dColorAr[j + 2] = cArUp[j + 2] - subdColors[j + 2];
      }
    }
  };

  Utils.makeProxy(Mesh, MeshResolution, function (proto) {
    return function () {
      return proto.apply(this.getMeshOrigin(), arguments);
    };
  });

  return MeshResolution;
});