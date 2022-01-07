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

_.sumBy = (iterable, f) => {
  let s = 0;
  _.each(iterable, i => {
    s += f(i);
  });
  return s;
};

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
    getObjectById: () => Game.getObjectById,
    ERR_INVALID_TARGET: ERR_INVALID_TARGET,
    ERR_NOT_IN_RANGE: ERR_NOT_IN_RANGE,
    ERR_NOT_ENOUGH_RESOURCES: ERR_NOT_ENOUGH_RESOURCES,
    ERR_FULL: ERR_FULL,
    OK: OK,
    FIND_STRUCTURES: FIND_STRUCTURES,
    FIND_CONSTRUCTION_SITES: FIND_CONSTRUCTION_SITES,
    rooms: () => Game.rooms,
    creeps: () => Game.creeps,
    STRUCTURE_EXTENSION: STRUCTURE_EXTENSION,
    STRUCTURE_ROAD: STRUCTURE_ROAD,
    STRUCTURE_SPAWN: STRUCTURE_SPAWN,
    STRUCTURE_CONTROLLER: STRUCTURE_CONTROLLER,
    LOOK_STRUCTURES: LOOK_STRUCTURES,
    LOOK_ENERGY: LOOK_ENERGY,
    memory: () => Memory,
  };
} else {
  // The actual constants are wrong which is good because code should
  // not reply on those values. If they were to there wouldn't be a
  // constant but a string you'd use. They could change so if this
  // causes code to go wrong then it is good because I can catch it.
  const g_memory = {};

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
    ERR_NOT_ENOUGH_RESOURCES: 'err_not_enough_resources',
    ERR_FULL: 'err_full',
    FIND_STRUCTURES: 'find_structures',
    FIND_CONSTRUCTION_SITES: 'find_construction_sites',
    OK: 'ok',
    getObjectById: () => getObjectByIdTrampoline,
    setGetObjectByIdTrampoline: setGetObjectByIdTrampoline,
    STRUCTURE_EXTENSION: 'structure_extension',
    STRUCTURE_ROAD: 'structure_road',
    STRUCTURE_SPAWN: 'structure_spawn',
    STRUCTURE_CONTROLLER: 'structure_controller',
    LOOK_STRUCTURES: 'look_structures',
    LOOK_ENERGY: 'look_energy',
    memory: () => g_memory,
  };
}
