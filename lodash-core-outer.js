if (global['_'] == undefined) {
  global['_'] = require('./lodash-core.js');
}

if (_.sumBy === undefined) {
  _.sumBy = (l, f) => {
    s = 0;
    for (let k in l) {
      let v = f(l[k]);
      s += v;
    }
    return s;
  };
}

module.exports = _;
