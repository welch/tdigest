var deepEqual = require('assert').deepEqual;
var assert = require('better-assert');
var TDigest = require('./tdigest').TDigest;

describe('digests in which each point becomes a centroid', function(){
  it('consumes a point', function(){
      var tdigest = new TDigest();
      tdigest.digest(0);
      var points = tdigest.asArray();
      deepEqual(points, [{mean:0, n:1}]);
  });
  it('consumes two points', function(){
      var tdigest = new TDigest();
      tdigest.digest(0);
      tdigest.digest(1);
      var points = tdigest.asArray();
      deepEqual(points, [{mean:0, n:1}, {mean:1, n:1}]);
  });
  it('consumes three points', function(){
      var tdigest = new TDigest();
      tdigest.digest(0);
      tdigest.digest(1);
      tdigest.digest(-1);
      var points = tdigest.asArray();
      deepEqual(points, [{mean:-1, n:1}, {mean:0, n:1}, {mean:1, n:1}]);
  });
  it('consumes same-valued points', function(){
      var tdigest = new TDigest(0, 0); // force a new centroid for each pt
      var i, N = 100;
      for (i = 0 ; i < N ; i = i + 1) {
          tdigest.digest(1000);
      }
      var points = tdigest.asArray(true);
      for (i = 0 ; i < N ; i += 1) {
          assert(points[i].mean === 1000 && points[i].cumn === i + 0.5);
      }
  });
  it('consumes increasing-valued points', function(){
      var tdigest = new TDigest(0, 0); // force a new centroid for each pt
      var i, N = 100;
      for (i = 0 ; i < N ; i += 1) {
          tdigest.digest(i*10);
      }
      var points = tdigest.asArray(true);
      for (i = 0 ; i < N ; i += 1) {
          assert(points[i].mean === i*10 && points[i].cumn === i + 0.5);
      }
  });
  it('consumes decreasing-valued points', function(){
      var tdigest = new TDigest(0, 0); // force a new centroid for each pt
      var i, N = 100;
      for (i = N - 1 ; i >= 0 ; i = i - 1) {
          tdigest.digest(i*10);
      }
      var points = tdigest.asArray(true);
      for (i = 0 ; i < N ; i += 1) {
          assert(points[i].mean === i*10 && points[i].cumn === i + 0.5);
      }
  });
});

describe('digests in which points are merged into centroids', function(){
    it('puts singletons on the ends and piles into the middle', function(){
        var tdigest = new TDigest(10, 0, 0); // plenty of room in the center
        var i, N = 10;
        tdigest.digest(0);
        tdigest.digest(1);
        tdigest.digest(0.5);
        for (i = 0 ; i < N ; i += 1) {
            tdigest.digest(0.4 + 0.2 * Math.random()); // 0.4 <= x < 0.6
        }
        var points = tdigest.asArray();
        assert(points.length === 3);
        assert(points[0].mean === 0 && points[0].n === 1);
        assert(points[1].mean >= 0.4 && points[1].mean < 0.6);
        assert(points[2].mean === 1 && points[2].n === 1);
    });
    it('preserves order as centroids merge and shift', function(){
        var tdigest = new TDigest(0,0); // suppress merging
        var i, N = 10;
        tdigest.digest(0);
        tdigest.digest(1);
        tdigest.digest(0.5);
        tdigest.digest(0.5);
        tdigest.digest(0.5);
        deepEqual( // no surprise here
            tdigest.asArray(true),
            [{mean:0, n:1, cumn:0.5},
             {mean:0.5, n:1, cumn:1.5},
             {mean:0.5, n:1,  cumn:2.5},
             {mean:0.5, n:1, cumn:3.5},
             {mean:1, n:1,  cumn:4.5}]
        );
        tdigest.delta = 10; // encourage merging (don't do this!)
        tdigest.digest(0.6);// 2/3 of the time merge will violate the ordering
        deepEqual(
            tdigest.asArray(),
            [{mean:0, n:1},
             {mean:0.5, n:1},
             {mean:0.5, n:1},
             {mean:0.55, n:2},
             {mean:1, n:1}]
        );
    }); 
    it('handles duplicates', function(){
        var tdigest = new TDigest(1,0,0);
        var i, N = 10;
        for (i = 0 ; i < N ; i++) {
            tdigest.digest(0.0);
            tdigest.digest(1.0);
            tdigest.digest(0.5);
        };
        deepEqual(
            tdigest.asArray(),
            [{mean:0.0, n:1},
             {mean:0.0, n:N-1},
             {mean:0.5, n:N},
             {mean:1.0, n:N-1},
             {mean:1.0, n:1}]
        );
    }); 
});

describe('redigest', function(){
  it('compresses increasing-valued points', function(){
      var tdigest = new TDigest(0, 0);
      var i, N = 100;
      for (i = 0 ; i < N ; i += 1) {
          tdigest.digest(i*10);
      }
      assert(tdigest.size() === 100);
      tdigest.delta = 0.1; // encourage merging (don't do this!)
      tdigest.redigest();
      var points = tdigest.asArray();
      assert(points.length < 100);
      assert(points[0].mean === 0);
      assert(points[points.length-1].mean === 990);
  });
  it('nonzero K automatically compresses during ingest', function(){
      var tdigest = new TDigest(1, 10);
      var i, N = 100;
      for (i = 0 ; i < N ; i += 1) {
          tdigest.digest(i*10);
      }
      var points = tdigest.asArray();
      assert(tdigest.nreset > 1);
      assert(points.length < 100);
      assert(points[0].mean === 0);
      assert(points[points.length-1].mean === 990);
  });
});

describe('quantiles', function(){
  it('quantiles from a single point', function(){
      var tdigest = new TDigest(0, 0);
      tdigest.digest(0);
      var x = [-0.5, 0, 0.5, 1.0, 1.5];
      var q = [0, 0, 1, 1, 1];
      deepEqual(tdigest.quantiles(x), q);
  });
  it('quantiles from two points', function(){
      var tdigest = new TDigest(0, 0);
      tdigest.digest(0);
      tdigest.digest(1);
      var x = [-0.5, 0, 0.5, 1.0, 1.5];
      var q = [0, 0, 0.5, 1, 1];
      deepEqual(tdigest.quantiles(x), q);
  });
  it('quantiles from three points', function(){
      var tdigest = new TDigest(0, 0);
      tdigest.digest(0);
      tdigest.digest(1);
      tdigest.digest(-1);
      var x = [-1.5, -1.0, -0.5, 0, 0.5, 1.0, 1.5];
      var q = [0, 0, 1/4, 1/2, 3/4, 1, 1];
      deepEqual(tdigest.quantiles(x), q);
  });
  it('quantiles from lots of uniformly distributed points', function(){
      var tdigest = new TDigest();
      var i, x=[], N = 100000;
      for (i = 0 ; i < N ; i += 1) {
          x.push(Math.random());
      }
      tdigest.digest(x);
      maxerr = 0;
      for (i = 0.01 ; i <= 1 ; i += 0.01) {
          var q = tdigest.quantile(i);
          maxerr = Math.max(maxerr, Math.abs(i-q));
      }
      assert(maxerr < 0.01);
  });
});

describe('percentiles', function(){
  it('percentiles from a single point', function(){
      var tdigest = new TDigest(0, 0);
      tdigest.digest(0);
      var p = [0, 0.5, 1.0];
      var x = [0, 0, 0];
      deepEqual(tdigest.percentiles(p), x);
  });
  it('percentiles from two points', function(){
      var tdigest = new TDigest(0, 0);
      tdigest.digest(0);
      tdigest.digest(1);
      var p = [0, 0.5, 1.0];
      var x = [0, 0.5, 1.0];
      deepEqual(tdigest.percentiles(p), x);
  });
  it('percentiles from three points', function(){
      var tdigest = new TDigest(0, 0);
      tdigest.digest(0);
      tdigest.digest(1);
      tdigest.digest(-1);
      var p = [0, 1/4, 1/2, 3/4, 1];
      var x = [-1.0, -0.5, 0, 0.5, 1.0];
      deepEqual(tdigest.percentiles(p), x);
  });
  it('percentiles from lots of uniformly distributed points', function(){
      var tdigest = new TDigest();
      var i, x=[], N = 100000;
      for (i = 0 ; i < N ; i += 1) {
          x.push(Math.random());
      }
      tdigest.digest(x);
      maxerr = 0;
      for (i = 0.01 ; i <= 1 ; i += 0.01) {
          var q = tdigest.percentile(i);
          maxerr = Math.max(maxerr, Math.abs(i-q));
      }
      assert(maxerr < 0.01);
  });
});


