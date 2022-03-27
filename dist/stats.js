const game = require('./game');
const _ = game._;

class Stats { 
  constructor (stats_prefix) {
    this.trim_stats(300);
    this.stats_prefix = stats_prefix
  }

  trim_stats (max_count) {
    const m = game.memory();
    m.stats = m.stats || [];
    const stats = m.stats;
    while (stats.length > max_count) {
      stats.shift();
    }
  }

  record_stat (key, value) {
    const m = game.memory();
    m.stats = m.stats || [];
    const stats = m.stats;
    if (this.stats_prefix) {
      stats.push([`${this.stats_prefix}.${key}`, value, game.time()]);
    } else {
      stats.push([key, value, game.time()]);
    }
  }
}

module.exports.Stats = Stats;
