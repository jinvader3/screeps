if (global['_'] === undefined) {
  global['_'] = require('../lodash-core-outer.js');
}

let g_f_getObjectById = null;

function setGetObjectByIdTrampoline(f) {
  g_f_getObjectById = f;
}

function getObjectByIdTrampoline (arg) {
  return g_f_getObjectById(arg);
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
    getObjectById: Game.getObjectById,
    ERR_INVALID_TARGET: ERR_INVALID_TARGET,
    ERR_NOT_IN_RANGE: ERR_NOT_IN_RANGE,
    OK: OK,
    rooms: Game.rooms,
    creeps: Game.creeps,
  };
} else {
  // The actual constants are wrong which is good because code should
  // not reply on those values. If they were to there wouldn't be a
  // constant but a string you'd use. They could change so if this
  // causes code to go wrong then it is good because I can catch it.
  module.exports = {
    _: _,
    WORK: 'work',
    MOVE: 'move',
    CARRY: 'carry',
    RESOURCE_ENERGY: 'energy',
    time: () => 0,
    FIND_MY_SPAWNS: 'find_my_spawns',
    FIND_SOURCES: 'find_sources',
    ERR_INVALID_TARGET: 'err_invalid_target',
    ERR_NOT_IN_RANGE: 'err_not_in_range',
    OK: 'ok',
    getObjectById: getObjectByIdTrampoline,
    setGetObjectByIdTrampoline: setGetObjectByIdTrampoline,
  };
}
