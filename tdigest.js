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
        // XXX super-narrow workaround for https://github.com/vadimg/js_bintrees/pull/14
        return NaN;
    }
    return a.mean - b.mean;
}

function compare_centroid_cumns(a, b) {
    // order two centroids by cumn. 
    //
    if (a === null) {
        // XXX super-narrow workaround for https://github.com/vadimg/js_bintrees/pull/14
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
};

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
    // find the centroid closest to x. The assumption of
    // unique means and a unique nearest centroid departs from the
    // paper, see _digest() below
    //
    if (this.size() === 0) {
        return null;
    }
    var iter = this.centroids.upperBound({mean:x}); // x < iter || iter==null
    var c = (iter.data() === null) ? iter.prev() : iter.data();
    // walk backwards looking for closest centroid.
    var nearest = c;
    var mindist = Math.abs(nearest.mean - x);
    var dx;
    while ((c = iter.prev()) && (dx = Math.abs(c.mean - x)) < mindist) {
        mindist = dx;
        nearest = c;
    }
    return nearest;
};

TDigest.prototype._new_centroid = function(x, n, cumn) {
    // create and insert a new centroid into the digest (don't update
    // cumulatives).
    //
    var c = {mean:x, n:n, cumn:cumn}; 
    this.centroids.insert(c);
    this.n += n;
    return c;
};

TDigest.prototype._addweight = function(nearest, x, n) {
    // add weight at location x to nearest centroid.  adding x to
    // nearest will not shift its relative position in the tree and
    // require reinsertion.
    //
    var newmean = nearest.mean + n * (x - nearest.mean) / (nearest.n + n);
    nearest.mean = newmean;
    nearest.n += n;
    nearest.cumn += n / 2;
    this.n += n;
};

TDigest.prototype._digest = function(x, n) {
    // incorporate value x, having count n into the TDigest.
    //
    var min = this.centroids.min();
    var max = this.centroids.max();
    if (this.size() === 0 || x < min.mean) {
        this._new_centroid(x, n, n / 2); // first or new min point
    } else if (max.mean < x ) {
        this._new_centroid(x, n, this.n + n / 2); // new max point
    } else {
        var nearest = this.find_nearest(x);
        if (nearest.mean === x) {
            // accumulate exact matches into the centroid without
            // limit. this is a departure from the paper, made so that
            // centroid means remain unique and code can be simple.
            this._addweight(nearest, x, n);
            return;
        }
        var p = nearest.cumn / this.n;
        var max_n = Math.floor(4 * this.n * this.delta * p * (1 - p));
        if (nearest != min && nearest != max && max_n - nearest.n >= n) {
            // if there's not room for all of n, don't bother merging
            // some of it into nearest, as we'll have to make a new
            // centroid anyway for the remainder (departure from the
            // paper).
            this._addweight(nearest, x, n);
        } else {
            // create a new centroid at x
            this._new_centroid(x, n, nearest.cumn); // approximate cumn
        }
        this._cumulate(false);
    }
    this._cumulate(false);
    if (this.K && this.size() > this.K / this.delta) {
        // re-process the centroids and hope for some compression.
        this.compress();
    }
};

TDigest.prototype.bound_mean = function(x) {
    // find centroids lower and upper such that lower.mean < x <
    // upper.mean or lower.mean === x === upper.mean. Don't call
    // this for x out of bounds.
    //
    var iter = this.centroids.upperBound({mean:x}); // x < iter
    var lower = iter.prev();      // lower <= x
    var upper = (lower.mean === x) ? lower : iter.next();
    return [lower, upper];
};

TDigest.prototype.quantile = function(x) {
    // return approximate quantile (0..1) for data value x.  Beware
    // that boundary values will report half their centroid weight
    // inward from 0/1. Data values outside the observed range return 0/1
    //
    // this triggers cumulate() if cumn's are out of date.
    //
    if (this.size() === 0) {
        return NaN;
    } else if (x < this.centroids.min().mean) {
        return 0.0;
    } else if (x > this.centroids.max().mean) {
        return 1.0;
    }
    // find centroids that bracket x and interpolate x's cumn from
    // their cumn's.
    var bound = this.bound_mean(x);
    var lower = bound[0], upper = bound[1];
    this._cumulate(true); // be sure cumns are exact
    var cumn = lower.cumn;
    if (lower !== upper) {
        cumn += (upper.cumn - lower.cumn) * (x - lower.mean) / (upper.mean - lower.mean);
    }
    return cumn / this.n;
};
    
TDigest.prototype.quantiles = function(xlist) {
    // return a list of quantiles for the values in xlist
    return xlist.map(this.quantile, this);
};

TDigest.prototype.bound_cumn = function(cumn) {
    // find centroids lower and upper such that lower.cumn < x <
    // upper.cumn or lower.cumn === x === upper.cumn. Don't call
    // this for cumn out of bounds.
    //
    // XXX because mean and cumn give rise to the same sort order
    // (up to identical means), use the mean rbtree for our cumn search.
    this.centroids._comparator = compare_centroid_cumns;
    var iter = this.centroids.upperBound({cumn:cumn}); // cumn < iter 
    this.centroids._comparator = compare_centroid_means;
    var lower = iter.prev();      // lower <= cumn
    var upper = (lower.cumn === cumn) ? lower : iter.next();
    return [lower, upper];
};

TDigest.prototype.percentile = function(p) {
    // return the approximate data value q at the specified percentile (0..1).
    // also known as the inverse cdf.
    //
    // this triggers cumulate() if cumn's are out of date.
    //
    this._cumulate(true); // be sure cumns are exact
    var cumn = p * this.n;
    var min = this.centroids.min();
    var max = this.centroids.max();
    if (this.size() === 0) {
        return NaN;
    } else if (cumn <= min.cumn) {
        return min.mean;
    } else if (cumn >= max.cumn) {
        return max.mean;
    }
    // find centroids whose cumns bracket cumn, then interpolate x
    // from their means. 
    var bound = this.bound_cumn(cumn);
    var lower = bound[0], upper = bound[1];
    var q = lower.mean;
    if (lower !== upper) {
        q += (upper.mean - lower.mean) * (cumn - lower.cumn) / (upper.cumn - lower.cumn);
    }
    return q;
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
    if (this.compressing) {
        return;
    }
    var points = this.toArray();
    this.reset();
    this.compressing = true;
    this.push_centroid(points.shift()); // min
    this.push_centroid(points.pop()); // max
    while (points.length > 0) {
        this.push_centroid(pop_random(points));
    }
    this._cumulate(true);
    this.compressing = false;
};

module.exports = {
    'TDigest': TDigest
};
