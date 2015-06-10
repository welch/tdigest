tdigest
============
[![Build Status](https://travis-ci.org/welch/tdigest.svg?branch=master)](https://travis-ci.org/welch/tdigest) [![NPM version](http://img.shields.io/npm/v/tdigest.svg)](https://www.npmjs.org/package/tdigest)

Javascript implementation of Dunning's T-Digest for streaming quantile approximation

The T-Digest is a data structure and algorithm for constructing an
approximate distribution for a collection of real numbers presented as a
stream. The algorithm makes no guarantees, but behaves well enough in
practice that implementations have been included in Apache Mahout and
ElasticSearch for computing summaries and approximate order
statistics over a stream.

For an overview of T-Digest's behavior, see Davidson-Pilon's
[blog post](http://dataorigami.net/blogs/napkin-folding/19055451-percentile-and-quantile-estimation-of-big-data-the-t-digest) regarding a python implementation. For more details,
there are the [tdigest paper](https://github.com/tdunning/t-digest/blob/master/docs/t-digest-paper/histo.pdf) and [reference implementation](https://github.com/tdunning/t-digest) (Java).
This javascript implementation is based on a reading of the paper,
with some boundary and performance tweaks.

Quickstart
------------

### node.js:

```
npm install tdigest
```

```javascript
var TDigest = require('tdigest').TDigest;
var x=[], N = 100000;
for (var i = 0 ; i < N ; i += 1) {
    x.push(Math.random() * 10 - 5);
};
tdigest = new TDigest();
tdigest.push(x);
tdigest.compress(x);
console.log(tdigest.summary());
console.log("median ~ "+tdigest.percentile(0.5));
```

See also [example.js](https://github.com/welch/tdigest/blob/master/example.js) in this package.

### In the browser:

The following grunt tasks are configured (via the [grunt-dry](https://www.npmjs.com/package/grunt-dry) dev dependency) to generate
a [UMD-wrapped](https://github.com/umdjs/umd) version of tdigest that can be loaded through a variety of front-end
module systems:

**grunt build**

Uses [grunt-pure-cjs](https://github.com/RReverser/grunt-pure-cjs) to generate browser/tdigest.js and browser/specs/*.spec.js by bundling the commonjs files into a single file for both the module itself and any mocha spec files.

**grunt test**

Runs unit tests using server-side mocha in node.js from `specs/*.js` and in browser using `browser/specs/*.js.
(the npm test script is configured to run this as well)

## Dependencies
`bintrees`: [https://www.npmjs.com/package/bintrees](https://www.npmjs.com/package/bintrees)



