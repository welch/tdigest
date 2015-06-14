//
// distributions:
//
// measure and report approximation error on classic distribution functions
//
var TDigest = require('./tdigest').TDigest;

function distributions(nruns, nsamples, npercentiles) {
    [uniform,
     gaussian,
     chisq,
     exponential,
     make_brownian()
    ].map( function(dist) {
        var fname = dist.toString().match(/function ([^\(]+)/)[1];
        console.log(fname + ": " + nruns + " runs digesting " +
                    nsamples + " points:");
        var errs = [0,0];
        for (var i = 0 ; i < nruns ; i++) {
            var err = compare_edf(dist, nsamples, npercentiles);
            errs[0] += err[0];
            errs[1] += err[1];
        }
        errs[0] /= nruns; 
        errs[1] /= nruns; 
        console.log(fname + ": avg rmse (relative) == " + errs[0] +
                    ", avg max err (relative) == " + errs[1]);
    });
}

function compare(d1, d2, N) {
    // compare digests d1 and d2 over N evenly spaced percentiles.
    // return RMSE and maximum error, both relative to the
    // distributions' maximum observed magnitude.
    //
    var maxerr = 0;
    var rmse = 0;
    var scale = Math.max(Math.abs(d1.percentile(0)), Math.abs(d1.percentile(1)),
                         Math.abs(d2.percentile(0)), Math.abs(d2.percentile(1)));
    for (var i = 0 ; i <= N ; i += 1) {
        var q1 = d1.percentile(i/N);
        var q2 = d2.percentile(i/N);
        maxerr = Math.max(maxerr, Math.abs(q1 - q2));
        rmse += (q1 - q2) * (q1 - q2);
    }
    rmse = Math.sqrt(rmse/i);
    return [rmse/scale, maxerr/scale];
}
    
function compare_edf(f, nsamples, npercentiles) {
    // draw samples from f, digest them, and compare digest percentile
    // results to EDF of original samples.
    //
    var edf = new TDigest(false);
    var digest = new TDigest();
    for (var i = 0 ; i < nsamples ; i++) {
        var x = f();
        edf.push(x);
        digest.push(x);
    }
    digest.compress();
    return compare(edf, digest, npercentiles);
}

function uniform() {
    return Math.random();
}

function boxmuller() {
    // return a pair of Box-Muller approximate normals, indexed by t
    var u = 2 * uniform() - 1;
    var v = 2 * uniform() - 1;
    var r = u*u + v*v;
    if (r === 0 || r > 1) {
        // out of bounds, try again
        var result = boxmuller();
        return result;
    }
    var c = Math.sqrt(-2*Math.log(r)/r);
    return [u*c, v*c];
}

function make_gaussian() {
    // return a function that returns N(0,1) samples when called
    var boxen = [];
    return function gaussian() {
        if (boxen.length === 0) {
            boxen = boxmuller();
        }
        return boxen.pop();
    };
}

var gaussian = make_gaussian();
    
function chisq() {
    var k = 3;
    var total = 0;
    for (var i = 0 ; i < k ; i++) {
        var x = gaussian();
        total += x * x;
    }
    return total;
}

function exponential() {
    return Math.exp(- Math.random());
}

function make_brownian() {
    var brownian_state = 0;
    return function brownian() {
        brownian_state += (gaussian() - 0.5);
        return brownian_state;
    };
}

distributions(10, 100000, 100);
