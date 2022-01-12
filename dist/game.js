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
    ATTACK: ATTACK,
    CARRY: CARRY,
    CLAIM: CLAIM,
    RESOURCE_ENERGY: RESOURCE_ENERGY,
    time: () => Game.time,
    FIND_MY_SPAWNS: FIND_MY_SPAWNS,
    FIND_SOURCES: FIND_SOURCES,
    FIND_HOSTILE_CREEPS: FIND_HOSTILE_CREEPS,
    getObjectById: () => Game.getObjectById,
    ERR_INVALID_TARGET: ERR_INVALID_TARGET,
    ERR_NOT_IN_RANGE: ERR_NOT_IN_RANGE,
    ERR_NOT_ENOUGH_RESOURCES: ERR_NOT_ENOUGH_RESOURCES,
    ERR_FULL: ERR_FULL,
    ERR_NO_BODYPART: ERR_NO_BODYPART,
    OK: OK,
    FIND_STRUCTURES: FIND_STRUCTURES,
    FIND_CONSTRUCTION_SITES: FIND_CONSTRUCTION_SITES,
    rooms: () => Game.rooms,
    creeps: () => Game.creeps,
    STRUCTURE_EXTENSION: STRUCTURE_EXTENSION,
    STRUCTURE_ROAD: STRUCTURE_ROAD,
    STRUCTURE_SPAWN: STRUCTURE_SPAWN,
    STRUCTURE_CONTROLLER: STRUCTURE_CONTROLLER,
    STRUCTURE_TOWER: STRUCTURE_TOWER,
    STRUCTURE_CONTAINER: STRUCTURE_CONTAINER,
    LOOK_STRUCTURES: LOOK_STRUCTURES,
    LOOK_ENERGY: LOOK_ENERGY,
    memory: () => Memory,
    cpu: () => Game.cpu,
  };
} else {
  // The actual constants are wrong which is good because code should
  // not reply on those values. If they were to there wouldn't be a
  // constant but a string you'd use. They could change so if this
  // causes code to go wrong then it is good because I can catch it.
  let g_memory = {};
  let g_cpu_used = 0;
  const g_cpu = {
    getUsed: () => g_cpu_used,
    setUsed: (v) => {
      g_cpu_used = v;
    },
  };

  const g_creeps = {};
  const g_rooms = {};

  module.exports = {
    _: _,
    cpu: () => g_cpu,
    rooms: () => g_rooms,
    creeps: () => g_creeps,
    WORK: 'work',
    MOVE: 'move',
    CARRY: 'carry',
    ATTACK: 'attack',
    CLAIM: 'claim',
    RESOURCE_ENERGY: 'energy',
    time: () => 0,
    FIND_MY_SPAWNS: 'find_my_spawns',
    FIND_SOURCES: 'find_sources',
    FIND_HOSTILE_CREEPS: 'find_hostile_creeps',
    ERR_INVALID_TARGET: 'err_invalid_target',
    ERR_NOT_IN_RANGE: 'err_not_in_range',
    ERR_NOT_ENOUGH_RESOURCES: 'err_not_enough_resources',
    ERR_FULL: 'err_full',
    ERR_NO_BODYPART: 'err_no_bodypart',
    FIND_STRUCTURES: 'find_structures',
    FIND_CONSTRUCTION_SITES: 'find_construction_sites',
    OK: 'ok',
    getObjectById: () => getObjectByIdTrampoline,
    setGetObjectByIdTrampoline: setGetObjectByIdTrampoline,
    STRUCTURE_EXTENSION: 'structure_extension',
    STRUCTURE_ROAD: 'structure_road',
    STRUCTURE_SPAWN: 'structure_spawn',
    STRUCTURE_CONTROLLER: 'structure_controller',
    STRUCTURE_TOWER: 'structure_tower',
    STRUCTURE_CONTAINER: 'structure_container',
    LOOK_STRUCTURES: 'look_structures',
    LOOK_ENERGY: 'look_energy',
    memory: () => g_memory,
    memory_clear: () => {
      g_memory = {};
    },
  };
}
