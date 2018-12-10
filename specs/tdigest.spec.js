var TDigest = require('../tdigest').TDigest;
var Buffer = require('buffer/').Buffer;
var assert = require('better-assert');
assert.deepEqual = require('chai').assert.deepEqual;
assert.closeTo = require('chai').assert.closeTo;
assert.throws = require('chai').assert.throws;


describe('T-Digests in which each point becomes a centroid', function(){
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
        var tdigest = new TDigest(0.001, 0); // force a new centroid for each pt
        var i, N = 100;
        for (i = 0 ; i < N ; i += 1) {
            tdigest.push(i*10);
        }
        var points = tdigest.toArray();
        for (i = 0 ; i < N ; i += 1) {
            assert(points[i].mean === i*10);
        }
    });
    it('consumes decreasing-valued points', function(){
        var tdigest = new TDigest(0.001, 0); // force a new centroid for each pt
        var i, N = 100;
        for (i = N - 1 ; i >= 0 ; i = i - 1) {
            tdigest.push(i*10);
        }
        var points = tdigest.toArray();
        for (i = 0 ; i < N ; i += 1) {
            assert(points[i].mean === i*10);
        }
    });
});

describe('T-Digests in which points are merged into centroids', function(){
    it('consumes same-valued points into a single point', function(){
        var tdigest = new TDigest(); 
        var i, N = 100;
        for (i = 0 ; i < N ; i = i + 1) {
            tdigest.push(1000);
        }
        var points = tdigest.toArray();
        assert.deepEqual(points, [{mean: 1000, n:N}]);
    });
    it('handles multiple duplicates', function(){
        var tdigest = new TDigest(1,0,0);
        var i, N = 10;
        for (i = 0 ; i < N ; i++) {
            tdigest.push(0.0);
            tdigest.push(1.0);
            tdigest.push(0.5);
        }
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
        var tdigest = new TDigest(0.001, 0);
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

describe('percentile ranks', function(){
    //
    // TDigests are really meant for large datasets and continuous
    // distributions.  On small or categorical sets, results can seem
    // strange because mass exists at boundary points. The small tests
    // here verify some precise behaviors that may not be relevant at
    // scale.
    //
    it('reports undefined when given no points', function(){
        var tdigest = new TDigest();
        var x = [1, 2, 3];
        assert.deepEqual(tdigest.p_rank(1), undefined);
        assert.deepEqual(tdigest.p_rank(x), [undefined,undefined,undefined]);
    });
    it('from a single point', function(){
        var tdigest = new TDigest();
        tdigest.push(0);
        var x = [-0.5, 0, 0.5, 1.0, 1.5];
        var q = [0, 0.5, 1, 1, 1];
        assert.deepEqual(tdigest.p_rank(x), q);
    });
    it('from two points', function(){
        var tdigest = new TDigest();
        tdigest.push([0, 1]);
        var x = [-0.5, 0, 0.5, 1.0, 1.5];
        var q = [0, 0.25, 0.5, 0.75, 1];
        assert.deepEqual(tdigest.p_rank(x), q);
    });
    it('from three points', function(){
        var tdigest = new TDigest();
        tdigest.push([-1, 0, 1] );
        var x = [-1.5, -1.0, -0.5, 0, 0.5, 1.0, 1.5];
        var q = [0, 1/6, 2/6, 3/6, 4/6, 5/6, 1];
        assert.deepEqual(tdigest.p_rank(x), q);
    });
    it('from three points is same as from multiples of those points', function(){
        var tdigest = new TDigest();
        tdigest.push([0,1,-1]);
        var x = [-1.5, -1.0, -0.5, 0, 0.5, 1.0, 1.5];
        var result1 = tdigest.p_rank(x);
        tdigest.push([0,1,-1]);
        tdigest.push([0,1,-1]);
        var result2 = tdigest.p_rank(x);
        assert.deepEqual(result1, result2);
    });
    it('from four points away from the origin', function(){
        var tdigest = new TDigest();
        tdigest.push([10,11,12,13]);
        var x = [9, 10, 11, 12, 13, 14];
        var q = [0, 1/8, 3/8, 5/8, 7/8, 1];
        assert.deepEqual(tdigest.p_rank(x), q);
    });
    it('from four points is same as from multiples of those points', function(){
        var tdigest = new TDigest(0, 0);
        tdigest.push([10,11,12,13]);
        var x = [9, 10, 11, 12, 13, 14];
        var result1 = tdigest.p_rank(x);
        tdigest.push([10,11,12,13]);
        tdigest.push([10,11,12,13]);
        var result2 = tdigest.p_rank(x);
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
            var q = tdigest.p_rank(i);
            maxerr = Math.max(maxerr, Math.abs(i-q));
        }
        assert(maxerr < 0.01);
    });
    it('from an exact match', function(){
        var tdigest = new TDigest(0.001,0); // no compression
        var i, N = 10;
        for (i = 0 ; i < N ; i += 1) {
            tdigest.push([10, 20, 30]);
        }
        assert(tdigest.p_rank(20) === 0.5);
    });
});

describe('percentiles', function(){
    it('reports undefined when given no points', function(){
        var tdigest = new TDigest();
        var p = [0, 0.5, 1.0];
        assert.deepEqual(tdigest.percentile(0.5), undefined);
        assert.deepEqual(tdigest.percentile(p), [undefined,undefined,undefined]);
    });
    it('from a single point', function(){
        var tdigest = new TDigest();
        tdigest.push(0);
        var p = [0, 0.5, 1.0];
        var x = [0, 0, 0];
        assert.deepEqual(tdigest.percentile(p), x);
    });
    it('from two points', function(){
        var tdigest = new TDigest();
        tdigest.push([0, 1]);
        var p = [-1/4, 0, 1/4, 1/2, 5/8, 3/4, 1, 1.25];
        var x = [  0,  0,  0,  0.5, 0.75, 1,  1, 1];
        assert.deepEqual(tdigest.percentile(p), x);
    });
    it('from three points', function(){
        var tdigest = new TDigest();
        tdigest.push([0, 0.5, 1]);
        var p = [0, 1/4, 1/2, 3/4, 1];
        var x = [0, 0.125, 0.5, 0.875, 1.0];
        assert.deepEqual(tdigest.percentile(p), x);
    });
    it('from four points', function(){
        var tdigest = new TDigest();
        tdigest.push([10, 11, 12, 13]);
        var p = [0, 1/4, 1/2, 3/4, 1];
        var x = [10.0, 10.5, 11.5, 12.5, 13.0];
        assert.deepEqual(tdigest.percentile(p), x);
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
            var q = tdigest.percentile(i);
            maxerr = Math.max(maxerr, Math.abs(i-q));
        }
        assert(maxerr < 0.01);
    });
});

describe('Serialise', function(){
    it('encode empty histogram large', function(){
        let tdigest = new TDigest();
        for (let i = 0 ; i < 100000 ; i += 1) {
            tdigest.push(Math.random());
        }
        let bytes = tdigest.asBytes();
        let base64Bytes= bytes.toString('base64');
        assert(base64Bytes.length > 60)
    });

    it('encode empty histogram small', function(){
        let tdigest = new TDigest();
        for (let i = 0 ; i < 100000 ; i += 1) {
            tdigest.push(Math.random());
        }
        let bytes = tdigest.asSmallBytes();
        let base64Bytes= bytes.toString('base64');
        assert(base64Bytes.length > 0)
    });

    it('encode and load empty histogram large', function(){
        let tdigest = new TDigest();
        for (let i = 0 ; i < 100000 ; i += 1) {
            tdigest.push(Math.random());
        }
        let bytes = tdigest.asBytes();
        let base64Bytes= bytes.toString('base64');

        let loadedTdigest = new TDigest().load(bytes);

        assert.closeTo(loadedTdigest.percentile(0.0),   tdigest.percentile(0.0), 0.00001);
        assert.closeTo(loadedTdigest.percentile(0.1),   tdigest.percentile(0.1), 0.00001);
        assert.closeTo(loadedTdigest.percentile(0.5),   tdigest.percentile(0.5), 0.00001);
        assert.closeTo(loadedTdigest.percentile(0.75),  tdigest.percentile(0.75), 0.00001);
        assert.closeTo(loadedTdigest.percentile(0.95),  tdigest.percentile(0.95), 0.00001);
        assert.closeTo(loadedTdigest.percentile(0.99),  tdigest.percentile(0.99), 0.00001);
        assert.closeTo(loadedTdigest.percentile(0.999), tdigest.percentile(0.999), 0.00001);
        assert.closeTo(loadedTdigest.percentile(1.0),   tdigest.percentile(1.0), 0.00001);
    });

    it('encode and load empty histogram small', function(){
        let tdigest = new TDigest();
        for (let i = 0 ; i < 100000 ; i += 1) {
            tdigest.push(Math.random());
        }
        let bytes = tdigest.asSmallBytes();
        let base64Bytes= bytes.toString('base64');
        console.log(base64Bytes);

        let loadedTdigest = new TDigest().load(bytes);

        assert.closeTo(loadedTdigest.percentile(0.0),   tdigest.percentile(0.0), 0.00001);
        assert.closeTo(loadedTdigest.percentile(0.1),   tdigest.percentile(0.1), 0.00001);
        assert.closeTo(loadedTdigest.percentile(0.5),   tdigest.percentile(0.5), 0.00001);
        assert.closeTo(loadedTdigest.percentile(0.75),  tdigest.percentile(0.75), 0.00001);
        assert.closeTo(loadedTdigest.percentile(0.95),  tdigest.percentile(0.95), 0.00001);
        assert.closeTo(loadedTdigest.percentile(0.99),  tdigest.percentile(0.99), 0.00001);
        assert.closeTo(loadedTdigest.percentile(0.999), tdigest.percentile(0.999), 0.00001);
        assert.closeTo(loadedTdigest.percentile(1.0),   tdigest.percentile(1.0), 0.00001);
    });

    it('load histogram large', function(){
        // Loads the serialised form of real_latency_sample_10000.csv, as serialised by AVLTreeDigest in the original impl
        let buffer = Buffer.from("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AAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAgAAAAEAAAABAAAAAQAAAAEAAAACAAAAAQAAAAEAAAABAAAAAgAAAAEAAAABAAAAAQAAAAEAAAABAAAAAgAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAIAAAACAAAAAQAAAAEAAAABAAAAAgAAAAEAAAABAAAAAQAAAAEAAAACAAAAAgAAAAEAAAABAAAAAwAAAAIAAAABAAAAAgAAAAMAAAAEAAAAAQAAAAEAAAACAAAAAgAAAAIAAAAEAAAAAgAAAAQAAAABAAAAAgAAAAQAAAAFAAAABQAAAAEAAAAFAAAAAQAAAAIAAAACAAAAAwAAAAIAAAABAAAABQAAAAMAAAAGAAAABQAAAAIAAAABAAAABAAAAAUAAAAGAAAABgAAAAQAAAAFAAAABAAAAAUAAAAEAAAAAgAAAAQAAAADAAAAAQAAAAQAAAAGAAAABAAAAAYAAAAIAAAAAQAAAAoAAAABAAAACQAAAAQAAAALAAAACgAAAAYAAAAJAAAACAAAAAUAAAAEAAAABAAAAAUAAAAHAAAABAAAAAQAAAABAAAAAwAAAAYAAAAFAAAACQAAAAYAAAAHAAAABgAAAAUAAAADAAAAAQAAAAMAAAAEAAAABgAAAAkAAAAIAAAADQAAAAoAAAAGAAAACAAAAAcAAAAFAAAACQAAAAsAAAAGAAAADQAAAAIAAAAKAAAACwAAAAgAAAADAAAACwAAAAYAAAAQAAAAEgAAAAoAAAAJAAAACAAAAAcAAAABAAAADwAAAAEAAAAPAAAAEQAAABQAAAAKAAAABgAAAAMAAAAFAAAABQAAAAkAAAARAAAAEQAAAAkAAAAHAAAAEAAAAAYAAAAEAAAACQAAABAAAAAYAAAADQAAABMAAAAIAAAACwAAABMAAAAQAAAABQAAABYAAAASAAAADAAAAAUAAAAFAAAABwAAAAkAAAAGAAAADgAAAAkAAAAKAAAADwAAABMAAAAPAAAAEwAAABMAAAAUAAAACAAAAAkAAAAKAAAACQAAAAoAAAALAAAACQAAAAcAAAARAAAACwAAABQAAAAQAAAAGwAAABsAAAAXAAAADwAAAAwAAAATAAAAGAAAACoAAAAcAAAAEAAAAAkAAAAVAAAAFAAAAA8AAAAYAAAAFQAAAA8AAAAKAAAAFgAAABoAAAAbAAAAFAAAABAAAAAVAAAAFAAAAAsAAAAMAAAACAAAABMAAAAXAAAAHQAAACAAAAATAAAAEwAAABwAAAAYAAAAIAAAAC8AAAAhAAAAGgAAACMAAAAOAAAADAAAAAwAAAAXAAAAIAAAAB8AAAAZAAAAHAAAACEAAAASAAAAGAAAABQAAAAXAAAAGgAAAB8AAAAeAAAAEAAAABEAAAAMAAAAEwAAACgAAAAjAAAAIQAAABwAAAAZAAAAHgAAABoAAAAqAAAAJgAAAB4AAAAZAAAAFAAAABsAAAAhAAAAKAAAADMAAAAvAAAALgAAAEAAAAA3AAAALAAAACEAAAAqAAAAKQAAACsAAAAvAAAAKwAAAB8AAAAXAAAAFgAAABYAAAAdAAAAHgAAABkAAAAeAAAAHwAAACMAAAAjAAAAKQAAACQAAAAdAAAAIgAAACcAAAApAAAAIwAAACcAAAAgAAAALAAAABwAAAA0AAAAWwAAAD8AAABNAAAARgAAADsAAAAqAAAAHAAAACUAAAArAAAANAAAAC4AAAA3AAAAMgAAADwAAAAcAAAAHQAAABQAAAAdAAAAEQAAABMAAAAuAAAANAAAADcAAAAeAAAAIAAAACEAAAAoAAAALQAAADgAAAA1AAAALAAAAB8AAAAtAAAAGwAAABYAAAAgAAAAFwAAAB4AAAAkAAAANQAAAB8AAAA+AAAATwAAACUAAAAfAAAAJgAAABsAAAAWAAAAHwAAACkAAAAbAAAAFAAAABkAAAARAAAAIwAAACsAAAAdAAAAIAAAAC4AAAAoAAAAEgAAABYAAAAZAAAAHAAAABgAAAAXAAAAHQAAADEAAAAuAAAALAAAAB8AAAAcAAAAEwAAAA0AAAAQAAAAFAAAACIAAAAZAAAAGgAAABoAAAAQAAAADAAAAA0AAAASAAAAHgAAACIAAAARAAAADAAAABwAAAARAAAADgAAACIAAAAtAAAAHwAAABoAAAAbAAAAJQAAAB4AAAAaAAAAFgAAABgAAAAVAAAAGQAAAB0AAAAfAAAAIAAAAB8AAAAVAAAAHwAAABMAAAAVAAAAIgAAABgAAAAhAAAADwAAAAsAAAASAAAACgAAACYAAAAbAAAAFgAAABwAAAAKAAAABQAAAAoAAAAGAAAAFAAAABMAAAAiAAAAGQAAABIAAAAJAAAAEAAAABgAAAAVAAAAFAAAAAYAAAALAAAADwAAABEAAAAWAAAAEgAAABkAAAAQAAAADgAAABAAAAAYAAAAGwAAAAwAAAAYAAAAGAAAABEAAAAOAAAADQAAAAkAAAAKAAAACAAAAAUAAAAGAAAABQAAAAYAAAAHAAAACAAAAAoAAAAHAAAACAAAAAMAAAADAAAACQAAAAsAAAAHAAAACQAAAAQAAAAGAAAADQAAAAwAAAANAAAADAAAAAoAAAAUAAAAFQAAABAAAAAFAAAACgAAAAkAAAAIAAAAAgAAAAQAAAAEAAAACQAAABAAAAANAAAACgAAAAoAAAAIAAAAAwAAAAcAAAAPAAAACwAAAAYAAAAHAAAACAAAAAsAAAANAAAACwAAAAYAAAAMAAAACwAAAAcAAAAHAAAABgAAAAkAAAAIAAAAAQAAAAQAAAADAAAAAgAAAAUAAAADAAAAAgAAAAQAAAACAAAAAQAAAAQAAAAFAAAABQAAAAIAAAAEAAAABAAAAAQAAAAFAAAAAQAAAAQAAAAKAAAACAAAAAcAAAAKAAAAAgAAAAcAAAAGAAAAAwAAAAEAAAAEAAAAAQAAAAMAAAAFAAAACAAAAAIAAAAGAAAAAwAAAAYAAAAEAAAABwAAAAMAAAAFAAAABAAAAAMAAAAEAAAAAgAAAAcAAAADAAAABwAAAAMAAAAFAAAAAgAAAAEAAAACAAAABAAAAAQAAAADAAAABAAAAAQAAAAEAAAAAgAAAAEAAAACAAAAAwAAAAEAAAADAAAABAAAAAIAAAABAAAAAgAAAAIAAAAEAAAAAwAAAAEAAAACAAAAAgAAAAEAAAADAAAABAAAAAQAAAABAAAABAAAAAEAAAABAAAAAgAAAAMAAAABAAAABAAAAAEAAAACAAAAAQAAAAIAAAABAAAAAQAAAAEAAAABAAAAAQAAAAIAAAADAAAAAQAAAAIAAAADAAAAAwAAAAMAAAABAAAAAgAAAAEAAAADAAAAAgAAAAEAAAADAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAgAAAAIAAAABAAAAAgAAAAIAAAACAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAgAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAE=", 'base64');
        let tdigest = new TDigest().load(buffer);

        assert.closeTo(tdigest.percentile(0.0),  0.0000022532144576767244, 0.00001);
        assert.closeTo(tdigest.percentile(0.25), 0.002707849708706082, 0.00001);
        assert.closeTo(tdigest.percentile(0.5), 0.005057272056353358, 0.00001);
        assert.closeTo(tdigest.percentile(0.75), 0.020531824377284173, 0.00001);
        assert.closeTo(tdigest.percentile(0.95), 0.365905991141179, 0.00001);
        assert.closeTo(tdigest.percentile(0.99), 0.9151628807072069, 0.00001);
        assert.closeTo(tdigest.percentile(0.999), 1.9919065380601644, 0.00001);
        assert.closeTo(tdigest.percentile(1.0), 6.195056868886852, 0.00001);
    });

    it('load histogram small', function(){
        // Loads the serialised form of real_latency_sample_10000.csv, as serialised by AVLTreeDigest in the original impl
        let buffer = Buffer.from("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O0/CYzt1BJI7cpLZO/C7TjtDxrE7yHeIOxyZsTuhClc8MkprO73mUztUx+A661qePAs6jDt7vHQ5cR2WOjNJ7zxOXjk7ry87PBpb7jvI8+Y7lvx/O7vmDjofJ047521YOmbshjsEruk7uZ4WO7Bbtjv0Ezg7AuB5OxmdQjga5Pc6DaTDOw26Gju2Z9k7Hk76O6+NvTxYCGQ7elWAO7IqxzwJrcA7MgihO2J8fDuKjh456dcaOhdIZjkVVa47pxcBO4Nf3Tut44c7lr0UPItn3jw6FRo7nYuDO5/zxjwhFtk7ckm+On4opDpYi/07UC1EOoBAqDvA12c7+JTEPBEc5Tw3EM87Bh6uOn4epTqh3qM8NvOQPDNlEDyf1x06wEyUPZA2OTylEic8VE8LOx9t1TyDRNw9ZKn7PRJYYTwVsx88jBF6PBJ57DwSaxg8u0rQPJapwDw2yDE8THjTPVkl6z0BkQo9vjM2PeZifjw82Jk+KTiHPWm3ij20pfE97tp6Pij7ljxoZ9Y+IsH6Pwdb/jw8vIg/llOUP/VeYgEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQIBAQEBAgEBAQIBAQEBAQIBAQEBAQECAgEBAQIBAQEBAgIBAQMCAQIDBAEBAgICBAIEAQIEBQUBBQECAgMCAQUDBgUCAQQFBgYEBQQFBAIEAwEEBgQGCAEKAQkECwoGCQgFBAQFBwQEAQMGBQkGBwYFAwEDBAYJCA0KBggHBQkLBg0CCgsIAwsGEBIKCQgHAQ8BDxEUCgYDBQUJEREJBxAGBAkQGA0TCAsTEAUWEgwFBQcJBg4JCg8TDxMTFAgJCgkKCwkHEQsUEBsbFw8MExgqHBAJFRQPGBUPChYaGxQQFRQLDAgTFx0gExMcGCAvIRojDgwMFyAfGRwhEhgUFxofHhARDBMoIyEcGR4aKiYeGRQbISgzLy5ANywhKikrLysfFxYWHR4ZHh8jIykkHSInKSMnICwcNFs/TUY7KhwlKzQuNzI8HB0UHRETLjQ3HiAhKC04NSwfLRsWIBceJDUfPk8lHyYbFh8pGxQZESMrHSAuKBIWGRwYFx0xLiwfHBMNEBQiGRoaEAwNEh4iEQwcEQ4iLR8aGyUeGhYYFRkdHyAfFR8TFSIYIQ8LEgomGxYcCgUKBhQTIhkSCRAYFRQGCw8RFhIZEA4QGBsMGBgRDg0JCggFBgUGBwgKBwgDAwkLBwkEBg0MDQwKFBUQBQoJCAIEBAkQDQoKCAMHDwsGBwgLDQsGDAsHBwYJCAEEAwIFAwIEAgEEBQUCBAQEBQEECggHCgIHBgMBBAEDBQgCBgMGBAcDBQQDBAIHAwcDBQIBAgQEAwQEBAIBAgMBAwQCAQICBAMBAgIBAwQEAQQBAQIDAQQBAgECAQEBAQECAwECAwMDAQIBAwIBAwEBAQEBAQICAQICAgEBAQEBAQEBAQIBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEB", 'base64');
        let tdigest = new TDigest().load(buffer);

        assert.closeTo(tdigest.percentile(0.0),  0.0000022532144576767244, 0.00001);
        assert.closeTo(tdigest.percentile(0.25), 0.002707849708706082, 0.00001);
        assert.closeTo(tdigest.percentile(0.5), 0.005057272056353358, 0.00001);
        assert.closeTo(tdigest.percentile(0.75), 0.020531824377284173, 0.00001);
        assert.closeTo(tdigest.percentile(0.95), 0.365905991141179, 0.00001);
        assert.closeTo(tdigest.percentile(0.99), 0.9151628807072069, 0.00001);
        assert.closeTo(tdigest.percentile(0.999), 1.9919065380601644, 0.00001);
        assert.closeTo(tdigest.percentile(1.0), 6.195056868886852, 0.00001);
    });

    it('load broken big histogram (too large)', function(){
        // Loads the serialised form of real_latency_sample_10000.csv, as serialised by AVLTreeDigest in the original impl
        let buffer = Buffer.from("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AAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAgAAAAEAAAABAAAAAgAAAAEAAAACAAAAAgAAAAEAAAACAAAAAgAAAAEAAAABAAAAAgAAAAIAAAABAAAAAQAAAAMAAAABAAAAAQAAAAIAAAABAAAAAgAAAAIAAAACAAAAAwAAAAEAAAADAAAAAwAAAAMAAAACAAAAAwAAAAMAAAACAAAAAwAAAAMAAAABAAAAAgAAAAIAAAADAAAAAgAAAAQAAAAEAAAABAAAAAIAAAAEAAAAAgAAAAQAAAAEAAAAAgAAAAMAAAAEAAAABQAAAAUAAAAFAAAABQAAAAIAAAAGAAAAAwAAAAUAAAAEAAAABQAAAAcAAAAFAAAABwAAAAYAAAADAAAAAwAAAAcAAAAFAAAACAAAAAcAAAAHAAAABwAAAAgAAAADAAAABQAAAAcAAAAGAAAACAAAAAcAAAAGAAAACAAAAA0AAAANAAAACAAAAAgAAAALAAAACAAAAAgAAAAHAAAABgAAAAgAAAAEAAAABwAAAAQAAAALAAAACgAAAAYAAAAIAAAACwAAAAoAAAAHAAAACwAAAAsAAAAGAAAACAAAAAkAAAALAAAACQAAAA8AAAANAAAACQAAAAwAAAARAAAADQAAABEAAAATAAAACgAAAAwAAAAIAAAACQAAAAwAAAANAAAAFQAAABEAAAAIAAAADwAAAA4AAAAPAAAACwAAAA4AAAAKAAAAEAAAAA8AAAAKAAAABAAAAAYAAAAQAAAADwAAAA4AAAARAAAACgAAAB0AAAASAAAADwAAABoAAAAQAAAAGQAAAAkAAAAJAAAADAAAAA4AAAAYAAAAGQAAABgAAAAeAAAAGwAAABQAAAAbAAAAIAAAACUAAAAcAAAAGAAAABkAAAAeAAAAIQAAACgAAAAjAAAAHQAAAC8AAAA6AAAAKAAAACAAAAAeAAAAIgAAAC8AAAAvAAAAJQAAACYAAAAqAAAAIQAAAB4AAAAYAAAAEwAAABkAAAAmAAAAMQAAABsAAAAgAAAAJwAAAD8AAAAyAAAAGwAAADAAAAAlAAAAKQAAACYAAAAsAAAANAAAACgAAAAe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", 'base64');
        assert.throws(() => new TDigest().load(buffer), /Centroid count requested is too high. Ensure your are loading the correct tdigest format./);
    });

    it('load broken small histogram (too large)', function(){
        // Loads the serialised form of real_latency_sample_10000.csv, as serialised by AVLTreeDigest in the original impl
        let buffer = Buffer.from("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", 'base64');
        assert.throws(() => new TDigest().load(buffer), /Centroid count requested is too high. Ensure your are loading the correct tdigest format./);
    });

    it('cap working small histogram (too large)', function(){
        // Loads the serialised form of real_latency_sample_10000.csv, as serialised by AVLTreeDigest in the original impl
        let buffer = Buffer.from("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O0/CYzt1BJI7cpLZO/C7TjtDxrE7yHeIOxyZsTuhClc8MkprO73mUztUx+A661qePAs6jDt7vHQ5cR2WOjNJ7zxOXjk7ry87PBpb7jvI8+Y7lvx/O7vmDjofJ047521YOmbshjsEruk7uZ4WO7Bbtjv0Ezg7AuB5OxmdQjga5Pc6DaTDOw26Gju2Z9k7Hk76O6+NvTxYCGQ7elWAO7IqxzwJrcA7MgihO2J8fDuKjh456dcaOhdIZjkVVa47pxcBO4Nf3Tut44c7lr0UPItn3jw6FRo7nYuDO5/zxjwhFtk7ckm+On4opDpYi/07UC1EOoBAqDvA12c7+JTEPBEc5Tw3EM87Bh6uOn4epTqh3qM8NvOQPDNlEDyf1x06wEyUPZA2OTylEic8VE8LOx9t1TyDRNw9ZKn7PRJYYTwVsx88jBF6PBJ57DwSaxg8u0rQPJapwDw2yDE8THjTPVkl6z0BkQo9vjM2PeZifjw82Jk+KTiHPWm3ij20pfE97tp6Pij7ljxoZ9Y+IsH6Pwdb/jw8vIg/llOUP/VeYgEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQIBAQEBAgEBAQIBAQEBAQIBAQEBAQECAgEBAQIBAQEBAgIBAQMCAQIDBAEBAgICBAIEAQIEBQUBBQECAgMCAQUDBgUCAQQFBgYEBQQFBAIEAwEEBgQGCAEKAQkECwoGCQgFBAQFBwQEAQMGBQkGBwYFAwEDBAYJCA0KBggHBQkLBg0CCgsIAwsGEBIKCQgHAQ8BDxEUCgYDBQUJEREJBxAGBAkQGA0TCAsTEAUWEgwFBQcJBg4JCg8TDxMTFAgJCgkKCwkHEQsUEBsbFw8MExgqHBAJFRQPGBUPChYaGxQQFRQLDAgTFx0gExMcGCAvIRojDgwMFyAfGRwhEhgUFxofHhARDBMoIyEcGR4aKiYeGRQbISgzLy5ANywhKikrLysfFxYWHR4ZHh8jIykkHSInKSMnICwcNFs/TUY7KhwlKzQuNzI8HB0UHRETLjQ3HiAhKC04NSwfLRsWIBceJDUfPk8lHyYbFh8pGxQZESMrHSAuKBIWGRwYFx0xLiwfHBMNEBQiGRoaEAwNEh4iEQwcEQ4iLR8aGyUeGhYYFRkdHyAfFR8TFSIYIQ8LEgomGxYcCgUKBhQTIhkSCRAYFRQGCw8RFhIZEA4QGBsMGBgRDg0JCggFBgUGBwgKBwgDAwkLBwkEBg0MDQwKFBUQBQoJCAIEBAkQDQoKCAMHDwsGBwgLDQsGDAsHBwYJCAEEAwIFAwIEAgEEBQUCBAQEBQEECggHCgIHBgMBBAEDBQgCBgMGBAcDBQQDBAIHAwcDBQIBAgQEAwQEBAIBAgMBAwQCAQICBAMBAgIBAwQEAQQBAQIDAQQBAgECAQEBAQECAwECAwMDAQIBAwIBAwEBAQEBAQICAQICAgEBAQEBAQEBAQIBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEB", 'base64');
        assert.throws(() => new TDigest().load(buffer, 20), /Centroid count requested is too high. Ensure your are loading the correct tdigest format./);
    });
});

