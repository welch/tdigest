var TDigest = require('../tdigest').TDigest;
var assert = require('chai').assert;

describe('digests in which each point becomes a centroid', function(){
    it('consumes a point', function(){
        var tdigest = new TDigest();
        tdigest.push(0);
        var points = tdigest.toArray();
        assert.deepEqual(points, [{mean:0, n:1}]);
    });
    it('consumes two points', function(){
        var tdigest = new TDigest();
        tdigest.push([0,1]);
        var points = tdigest.toArray();
        assert.deepEqual(points, [{mean:0, n:1}, {mean:1, n:1}]);
    });
    it('consumes three points', function(){
        var tdigest = new TDigest();
        tdigest.push([0, 1, -1]);
        var points = tdigest.toArray();
        assert.deepEqual(points, [{mean:-1, n:1}, {mean:0, n:1}, {mean:1, n:1}]);
    });
    it('consumes increasing-valued points', function(){
        var tdigest = new TDigest(0, 0); // force a new centroid for each pt
        var i, N = 100;
        for (i = 0 ; i < N ; i += 1) {
            tdigest.push(i*10);
        }
        var points = tdigest.toArray(true);
        for (i = 0 ; i < N ; i += 1) {
            assert(points[i].mean === i*10 && points[i].cumn === i + 0.5);
        }
    });
    it('consumes decreasing-valued points', function(){
        var tdigest = new TDigest(0, 0); // force a new centroid for each pt
        var i, N = 100;
        for (i = N - 1 ; i >= 0 ; i = i - 1) {
            tdigest.push(i*10);
        }
        var points = tdigest.toArray(true);
        for (i = 0 ; i < N ; i += 1) {
            assert(points[i].mean === i*10 && points[i].cumn === i + 0.5);
        }
    });
});

describe('digests in which points are merged into centroids', function(){
    it('consumes same-valued points into a single point', function(){
        var tdigest = new TDigest(); 
        var i, N = 100;
        for (i = 0 ; i < N ; i = i + 1) {
            tdigest.push(1000);
        }
        var points = tdigest.toArray(true);
        assert.deepEqual(points, [{mean: 1000, n:N, cumn: N / 2}]);
    });
    it('handles multiple duplicates', function(){
        var tdigest = new TDigest(1,0,0);
        var i, N = 10;
        for (i = 0 ; i < N ; i++) {
            tdigest.push(0.0);
            tdigest.push(1.0);
            tdigest.push(0.5);
        };
        assert.deepEqual(
            tdigest.toArray(),
            [{mean:0.0, n:N},
             {mean:0.5, n:N},
             {mean:1.0, n:N}]
        );
    }); 
});

describe('compress', function(){
    it('compresses points and preserves bounds', function(){
        var tdigest = new TDigest(0, 0);
        var i, N = 100;
        for (i = 0 ; i < N ; i += 1) {
            tdigest.push(i*10);
        }
        assert(tdigest.size() === 100);
        tdigest.delta = 0.1; // encourage merging (don't do this!)
        tdigest.compress();
        var points = tdigest.toArray();
        assert(points.length < 100);
        assert(points[0].mean === 0);
        assert(points[points.length-1].mean === (N - 1) * 10);
    });
    it('K automatically compresses during ingest', function(){
        var tdigest = new TDigest();
        var i, N = 10000;
        for (i = 0 ; i < N ; i += 1) {
            tdigest.push(i*10);
        }
        var points = tdigest.toArray();
        assert(tdigest.nreset > 1);
        assert(points.length < 10000);
        assert(points[0].mean === 0);
        assert(points[points.length-1].mean === 99990);
    });
});

describe('quantiles', function(){
    //
    // TDigests are really meant for large datasets and continuous
    // distributions.  On small or categorical sets, results can seem
    // strange because mass exists at boundary points. The small tests
    // here verify some precise behaviors that may not be relevant at
    // scale.
    //
    it('from a single point', function(){
        var tdigest = new TDigest(0, 0);
        tdigest.push(0);
        var x = [-0.5, 0, 0.5, 1.0, 1.5];
        var q = [0, 0.5, 1, 1, 1];
        assert.deepEqual(tdigest.quantiles(x), q);
    });
    it('from two points', function(){
        var tdigest = new TDigest(0, 0);
        tdigest.push([0, 1]);
        var x = [-0.5, 0, 0.5, 1.0, 1.5];
        var q = [0, 0.25, 0.5, 0.75, 1];
        assert.deepEqual(tdigest.quantiles(x), q);
    });
    it('from three points', function(){
        var tdigest = new TDigest(0, 0);
        tdigest.push([-1, 0, 1] );
        var x = [-1.5, -1.0, -0.5, 0, 0.5, 1.0, 1.5];
        var q = [0, 1/6, 2/6, 3/6, 4/6, 5/6, 1];
        assert.deepEqual(tdigest.quantiles(x), q);
    });
    it('from three points is same as from multiples of those points', function(){
        var tdigest = new TDigest(0, 0);
        tdigest.push([0,1,-1]);
        var x = [-1.5, -1.0, -0.5, 0, 0.5, 1.0, 1.5];
        var result1 = tdigest.quantiles(x);
        tdigest.push([0,1,-1]);
        tdigest.push([0,1,-1]);
        var result2 = tdigest.quantiles(x);
        assert.deepEqual(result1, result2);
    });
    it('from four points away from the origin', function(){
        var tdigest = new TDigest(0, 0);
        tdigest.push([10,11,12,13]);
        var x = [9, 10, 11, 12, 13, 14];
        var q = [0, 1/8, 3/8, 5/8, 7/8, 1];
        assert.deepEqual(tdigest.quantiles(x), q);
    });
    it('from four points is same as from multiples of those points', function(){
        var tdigest = new TDigest(0, 0);
        tdigest.push([10,11,12,13]);
        var x = [9, 10, 11, 12, 13, 14];
        var result1 = tdigest.quantiles(x);
        tdigest.push([10,11,12,13]);
        tdigest.push([10,11,12,13]);
        var result2 = tdigest.quantiles(x);
        assert.deepEqual(result1, result2);
    });
    it('from lots of uniformly distributed points', function(){
        var tdigest = new TDigest();
        var i, x=[], N = 100000;
        var maxerr = 0;
        for (i = 0 ; i < N ; i += 1) {
            x.push(Math.random());
        }
        tdigest.push(x);
        tdigest.compress();
        for (i = 0.01 ; i <= 1 ; i += 0.01) {
            var q = tdigest.quantile(i);
            maxerr = Math.max(maxerr, Math.abs(i-q));
        }
        assert(maxerr < 0.01);
    });
    it('from an exact match', function(){
        var tdigest = new TDigest(0,0); // no compression
        var i, N = 10;
        var maxerr = 0;
        for (i = 0 ; i < N ; i += 1) {
            tdigest.push([10, 20, 30]);
        }
        assert(tdigest.quantile(20) === 0.5);
    });
});

describe('percentiles', function(){
    it('percentiles from a single point', function(){
        var tdigest = new TDigest(0, 0);
        tdigest.push(0);
        var p = [0, 0.5, 1.0];
        var x = [0, 0, 0];
        assert.deepEqual(tdigest.percentiles(p), x);
    });
    it('percentiles from two points', function(){
        var tdigest = new TDigest(0, 0);
        tdigest.push([0, 1]);
        var p = [0, 1/4, 1/2, 3/4, 1];
        var x = [0, 0, 0.5, 1.0, 1.0];
        assert.deepEqual(tdigest.percentiles(p), x);
    });
    it('percentiles from three points', function(){
        // this one is strange-looking but correct: moving 1/4 into
        // the distribution moves you 1/4 * 3 into cumn, which puts
        // you 3/4 of the way into the first point (the 0 boundary
        // point, which has 0.5 cumn at 0), or halfway to the halfway
        // point between the 0 point and the 0.5 point, which is
        // 1/8. All because of the 0.5 below the 0 point that we don't
        // like to reason about.
        var tdigest = new TDigest(0, 0);
        tdigest.push([0, 0.5, 1]);
        var p = [0, 1/4, 1/2, 3/4, 1];
        var x = [0, 1/8, 4/8, 7/8, 1];
        assert.deepEqual(tdigest.percentiles(p), x);
    });
    it('percentiles from three points is same as multiples of the points', function(){
        var tdigest = new TDigest(0, 0);
        tdigest.push([10,11,12]);
        var p = [0, 1/4, 1/2, 3/4, 1];
        var result1 = tdigest.percentiles(p);
        tdigest.push([10,11,12]);
        tdigest.push([10,11,12]);
        var result2 = tdigest.percentiles(p);
        assert.deepEqual(result1, result2);
    });
    it('percentiles from lots of uniformly distributed points', function(){
        var tdigest = new TDigest();
        var i, x=[], N = 100000;
        var maxerr = 0;
        for (i = 0 ; i < N ; i += 1) {
            x.push(Math.random());
        }
        tdigest.push(x);
        tdigest.compress();
        for (i = 0.01 ; i <= 1 ; i += 0.01) {
            var q = tdigest.percentile(i);
            maxerr = Math.max(maxerr, Math.abs(i-q));
        }
        assert(maxerr < 0.01);
    });
});


