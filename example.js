var TDigest = require('./tdigest').TDigest;
function round2(x) { return +(Math.round(x + "e+2")  + "e-2"); }
function round4(x) { return +(Math.round(x + "e+4")  + "e-4"); }

var x=[], N = 1000000;
tdigest = new TDigest();
for (var i = 0 ; i < N ; i += 1) {
    x.push(Math.random() * 10 - 5);
};
tdigest.digest(x);
console.log(tdigest.summary());
for (var p = 0 ; p <= 1.0 ; p += 0.1) {
    console.log("p = "+round2(p)+", q ~ "+round2(tdigest.percentile(p)));
};
for (var q = -5 ; q <= 5 ; q += 1.0) {
    console.log("q = "+q+", p ~ "+round4(tdigest.quantile(q)));
};
