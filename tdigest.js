var RBTree = require('bintrees').RBTree;

function TDigest(delta, K, CX) {
    // allocate a TDigest structure.
    //
    // delta is the compression factor, related to the max fraction of
    // counts that can be owned by one centroid (bigger means more
    // compression).
    //
    // K is a size threshold that triggers recompression as the TDigest
    // grows during input.  (Set it to 0 to disable automatic recompression)
    //
    // CX specifies how often to update cached cumulative totals used
    // for quantile estimation during ingest (see cumulate()).  Set to
    // 0 to use exact quantiles for each new point.
    //
    this.delta = (delta === undefined) ? 0.01 : delta;
    this.K = (K === undefined) ? 25 : K;
    this.CX = (CX === undefined) ? 1.1 : CX;
    this.centroids = new RBTree(compare_centroid_means);
    this.nreset = 0;
    this.reset();
}

TDigest.prototype.reset = function() {
    // prepare to digest new points.
    //
    this.centroids.clear();
    this.n = 0;
    this.nreset += 1;
    this.last_cumulate = 0;
};

TDigest.prototype.size = function() {
    return this.centroids.size;
};

TDigest.prototype.toArray = function(everything) {
    // return {mean,n} of centroids as an array ordered by mean.
    //
    var result = [];
    if (everything) {
        this._cumulate(true); // be sure cumns are exact
        this.centroids.each(function(c) { result.push(c); });
    } else {
        this.centroids.each(function(c) { result.push({mean:c.mean, n:c.n}); });
    }
    return result;
};
    
TDigest.prototype.summary = function() {
    var s = ["approximating "+this.n+" samples using "+
             this.size()+" centroids, delta="+this.delta+", CX="+this.CX,
             "min = "+this.percentile(0),
             "Q1  = "+this.percentile(0.25),
             "Q2  = "+this.percentile(0.5),
             "Q3  = "+this.percentile(0.75),
             "max = "+this.percentile(1.0)];
    return s.join('\n');
};

function compare_centroid_means(a, b) {
    // order two centroids by mean.
    //
    if (a === null) {
        // XXX super-narrow workaround for
        // https://github.com/vadimg/js_bintrees/pull/14
        return NaN;
    }
    if (a.mean !== b.mean) {
        return (a.mean - b.mean);
    } else if (a.cumn !== undefined && b.cumn !== undefined) {
        // RBtrees can't accommodate duplicates, use cumn as tiebreaker.
        return (a.cumn - b.cumn);
    } else {
        return 0 ; // equality is ok during searches
    }
}

function compare_centroid_cumns(a, b) {
    // order two centroids by cumn. 
    //
    if (a === null) {
        // XXX super-narrow workaround for
        // https://github.com/vadimg/js_bintrees/pull/14
        return NaN;
    }
    return (a.cumn - b.cumn);
}

function pop_random(choices) {
    // remove and return an item randomly chosen from the array of choices
    // (mutates choices)
    //
    var idx = Math.floor(Math.random() * choices.length);
    return choices.splice(idx, 1)[0];
}

TDigest.prototype.push = function(x, n) {
    // incorporate value or array of values x, having count n into the
    // TDigest. n defaults to 1.
    //
    n = n || 1;
    x = Array.isArray(x) ? x : [x];
    for (var i = 0 ; i < x.length ; i++) {
        this._digest(x[i], n);
    }
};

TDigest.prototype.push_centroid = function(c) {
    // incorporate centroid or array of centroids c
    //
    c = Array.isArray(c) ? c : [c];
    for (var i = 0 ; i < c.length ; i++) {
        this._digest(c[i].mean, c[i].n);
    }
}

TDigest.prototype._cumulate = function(exact) {
    // update cumulative counts for each centroid
    //
    // exact: falsey means only cumulate after sufficient
    // growth. During ingest, these counts are used as quantile
    // estimates, and they work well even when somewhat out of
    // date. (this is a departure from the publication, you may set CX
    // to 0 to disable).
    //
    if (this.n === this.last_cumulate ||
        !exact && this.CX && this.CX > (this.n / this.last_cumulate)) {
        return;
    }
    var cumn = 0;
    this.centroids.each(function(c) {
        c.cumn = cumn + c.n/2 ; // at the mean, we've accumulated half the n.
        cumn += c.n;
    });
    this.n = this.last_cumulate = cumn;
};

TDigest.prototype.find_nearest = function(x) {
    // find the centroid(s) whose means are closest to x (there can be
    // multiples because of per-centroid count limits, particularly in
    // categorical streams).
    //
    var iter = this.centroids.upperBound({mean:x}); // x < iter || iter==null
    var c = (iter.data() === null) ? iter.prev() : iter.data();
    if (c === null) {
        return [];
    }
    // walk the duplicates to find rightmost bound
    while (iter.next() !== null && iter.data().mean === c.mean) {
    }
    // walk backwards looking for closest centroids. 
    c = iter.prev();
    var min = Math.abs(c.mean - x);
    var nearest = [c];
    var dx;
    while ((c = iter.prev()) && (dx = Math.abs(c.mean - x)) <= min) {
        if (dx < min) {
            min = dx;
            nearest = [];
        }
        nearest.push(c);
    }
    return nearest;
};

TDigest.prototype._new_centroid = function(x, n, cumn) {
    // create and insert a new centroid into the digest (don't update
    // cumulatives).
    //
    // XXX for inserting, cumn needs to be a unique tiebreaker (the
    // RBTree implementation doesn't accept duplicates). After
    // inserting, set cumn to its given value since we never rely on
    // cumn order among equivalent means.
    //
    var c = {mean:x, n:n, cumn:this.n+n}; 
    this.centroids.insert(c);
    c.cumn = cumn;
    this.n += n;
};

TDigest.prototype._addweight = function(c, x, n, inplace) {
    // add weight at location x to centroid c
    //
    var newmean = c.mean + n * (x - c.mean) / (c.n + n);
    if (inplace) {
        c.mean = newmean;
        c.n += n;
        c.cumn += n / 2;
        this.n += n;
    } else {
        this.centroids.remove(c);
        this.n -= n;
        this._new_centroid(newmean, c.n + n, c.cumn + n / 2);
    }
};

TDigest.prototype._centroid_quantile = function(c) {
    // quantile estimate for a centroid's mean is a simple special case
    //
    if (this.size() === 0) {
        return NaN;
    } else if (c === this.centroids.min()) {
        return 0.0;
    } else if (c === this.centroids.max()) {
        return 1.0;
    } else {
        return c.cumn / this.n;
    }
};

TDigest.prototype._digest = function(x, n) {
    // incorporate value x, having count n into the TDigest.
    //
    var nearest = this.find_nearest(x);
    var inplace = (nearest.length <= 1 || nearest[0].mean === x);
    var cumn = (nearest.length > 0) ? nearest[0].cumn : 0;
    while (nearest.length > 0 && n > 0) {
        var c = pop_random(nearest);
        // even though all c's are the same distance, they have different
        // cumn's. get a fresh q, it affects boundary preservation
        var q = (cumn > 0) ? this._centroid_quantile(c) : 0; 
        var max_n = Math.floor(4 * this.n * this.delta * q * (1 - q));
        var room = max_n - c.n;
        if (room <= 0) {
            continue;
        }
        var dn = Math.min(n, room);
        this._addweight(c, x, dn, inplace);
        n -= dn;
    }
    if (n > 0) {
        // create a new centroid at x for the undigested counts.
        this._new_centroid(x, n, cumn + n / 2); // approximate cumn
    }
    this._cumulate(false);
    if (this.K && this.size() > this.K / this.delta) {
        // re-process the centroids and hope for some compression.
        this.compress();
    }
};

TDigest.prototype.bound_mean = function(x) {
    // find rightmost centroids (in case of duplicate means) lower and
    // upper such that lower.mean <= x < upper.mean
    //
    var iter = this.centroids.upperBound({mean:x}); // x < iter
    var c = iter.prev();      // c <= x
    var cnext = iter.next() ; // x < cnext
    while (iter.next() !== null && iter.data().mean === cnext.mean) {
        cnext = iter.data(); // walk the duplicates to find rightmost
    }
    return [c, cnext];
};

TDigest.prototype.bound_cumn = function(cumn) {
    // find centroids lower and upper such that lower.cumn <= cumn < upper.cumn
    //
    this._cumulate(true); // be sure cumns are exact
    // XXX because mean and cumn give rise to the same sort order
    // (up to identical means), use the mean rbtree for our cumn search.
    this.centroids._comparator = compare_centroid_cumns;
    var iter = this.centroids.upperBound({cumn:cumn}); // cumn < iter 
    var c = iter.prev();      // c <= cumn
    var cnext = iter.next() ; // cumn < cnext, no worries about duplicates
    this.centroids._comparator = compare_centroid_means;
    return [c, cnext];
};

TDigest.prototype.quantile = function(x) {
    // return approximate quantile for value x, in the range 0..1.  In
    // a small departure from the published algorithm, don't extrapolate
    // beyond endpoints (we do not expect c.n > 1 in the extreme
    // centroids, and don't want to invent density beyond them)
    //
    // this triggers cumulate() if cumn's are out of date.
    //
    if (this.size() === 0) {
        return NaN;
    } else if (x <= this.centroids.min().mean) {
        return 0.0;
    } else if (x >= this.centroids.max().mean) {
        return 1.0;
    }
    // find centroids that bracket x and interpolate x's cumn from
    // their cumn's.
    var bound = this.bound_mean(x);
    var lower = bound[0], upper = bound[1];
    this._cumulate(true); // be sure cumns are exact
    var dxn = (upper.cumn - lower.cumn) * (x - lower.mean) / (upper.mean - lower.mean);
    // correct for endpoint weight truncation. Since we expect the extremes
    // to have a single point each, expect to lose a half from each. 
    return (lower.cumn + dxn - 0.5) / (this.n - 1);
};
    
TDigest.prototype.quantiles = function(xlist) {
    // return a list of quantiles for the values in xlist
    return xlist.map(this.quantile, this);
};

TDigest.prototype.percentile = function(p) {
    // return the approximate x value for the specified percentile.
    // As with quantiles, map between [0..1] and the observed range of data.
    //
    // this triggers cumulate() if cumn's are out of date.
    //
    var cumn = p * (this.n - 1) + 0.5; // correct for endweight truncation
    if (this.size() === 0) {
        return NaN;
    } else if (cumn <= 0.5) {
        return this.centroids.min().mean;
    } else if (cumn >= this.n - 0.5) {
        return this.centroids.max().mean;
    }
    // find centroids whose cumns bracket cumn, then interpolate x
    // from their means. 
    var bound = this.bound_cumn(cumn);
    var lower = bound[0], upper = bound[1];
    var dx = (upper.mean - lower.mean) * (cumn - lower.cumn) / (upper.cumn - lower.cumn);
    return lower.mean + dx;
};
    
TDigest.prototype.percentiles = function(plist) {
    // return a list of percentile values for the percentages in plist
    return plist.map(this.percentile, this);
};

TDigest.prototype.compress = function() {
    // TDigests experience worst case compression (none) when input
    // increases monotonically.  Improve on any bad luck by
    // reconsuming digest centroids as if they were weighted points
    // while shuffling their order (and hope for the best).
    //
    var points = this.toArray();
    this.reset();
    this.push_centroid(points.shift()); // min
    this.push_centroid(points.pop()); // max
    while (points.length > 0) {
        this.push_centroid(pop_random(points));
    }
    this._cumulate(true);
};

module.exports = {
    'TDigest': TDigest
};
