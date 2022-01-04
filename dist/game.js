if (global['_'] === undefined) {
  global['_'] = require('../lodash-core-outer.js');
}

if (global['Game'] !== undefined) {
  module.exports = {
    _: _,
    WORK: WORK,
    MOVE: MOVE,
    CARRY: CARRY,
    RESOURCE_ENERGY: RESOURCE_ENERGY,
    time: () => Game.time,
    FIND_MY_SPAWNS: FIND_MY_SPAWNS,
    FIND_SOURCES: FIND_SOURCES,    
  };
} else {
  module.exports = {
    _: _,
    WORK: 'work',
    MOVE: 'move',
    CARRY: 'carry',
    RESOURCE_ENERGY: 'energy',
    time: () => 0,
    FIND_MY_SPAWNS: 'find_my_spawns',
    FIND_SOURCES: 'find_sources',
  };
}
