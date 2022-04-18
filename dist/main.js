const game = require('./game');
const _ = game._;
const { Room } = require('./room');
const { TaskEngine } = require('./task');
const { Stats } = require('./stats');
const { logging } = require('./logging');
const cmds = require('./cmds');

// Harlem's communication module. It registers global variables.
require('./communication.user');

module.exports.rooms = {};

module.exports.loop = function () {
  if (game.shard === undefined || game.shard().name !== 'shard3') {
    return;
  }

  MESSENGER.run('JeffRedbeard', [
    'Harlem', 'Balthael', 'Aethercyn'
  ]);

  cmds.register();

  let rooms = {};
  module.exports.rooms = rooms;

  let creep_deaths = [];
  
  Memory.ecfg = Memory.ecfg || {};
  let ecfg = Memory.ecfg; 

  logging.info('creating rooms');
  for (let name in game.rooms()) {
    let room = game.rooms()[name];
    // Only if we have a controller and the controller is ours.
    if (room.controller !== undefined && room.controller.my) {
      ecfg[name] = ecfg[name] || {};
      let robj = new Room(
        room,           // room object
        ecfg,           // global configuration
        ecfg[name]      // configuration per room
      );
      room.robj = robj;
      rooms[name] = robj;
    }
  }	

  logging.info('clearing dead creep memory');
  for (let name in game.memory().creeps) {
    if (game.creeps()[name] === undefined) {
      let m = game.memory().creeps[name];

      name = m.name !== undefined ? m.name : name;
      
      let parts = name.split(':');
      let rn = parts[0];

      if (rooms[rn]) {
        rooms[rn].add_creep_death(m);
      }

      delete game.memory().creeps[name];
    }
  }

  logging.info('clearing dead creep tasks');
  const tasks = game.memory().tasks;
  for (let name in tasks) {
    // "root/room:<name>/creep:<name>"
    const parts = name.split('/');

    if (parts.length !== 3) {
      continue;
    }

    if (parts[0] !== 'root') {
      continue;
    }

    if (parts[1].indexOf('room:') !== 0) {
      continue;
    }

    if (parts[2].indexOf('creep:') !== 0) {
      continue;
    }

    const creep_name = parts[2].substr(parts[2].indexOf(':') + 1);
    if (!(creep_name in game.creeps())) {
      logging.debug(`removed task for ${creep_name}`);
      delete tasks[name];
    }
  }

  logging.info('adding creeps to rooms');
  for (let name in game.creeps()) {
	  let creep = game.creeps()[name];

    if (creep.memory.name !== undefined) {
      name = creep.memory.name;
    }

    let parts = name.split(':');
    let rn = parts[0];

    //console.log('adding creep to room', rn);
    
    if (rooms[rn] !== undefined) {
      // If controller is lost this could happen. Not sure
      // the best behavior. But, for now, this prevents the
      // failure of the entire script.
      //console.log('creep added to room');
      rooms[rn].add_creep(creep);
    }
	}

  logging.info('running rooms as tasks');
  let te = new TaskEngine();
  for (let rname in rooms) {
    logging.info(`creating task for room ${rname}`); 
    let task = te.spawn(0, `room:${rname}`, task => {
      logging.info(`task calling tick for room ${rname}`);
      rooms[rname].tick(task);
    });

    // Each tick give 3 CPU with 20 CPU bucket.
    task.credit(3, 20);
  }

  let res = te.run_tasks();

  _.each(res, stat => {
    console.log(stat[0], stat[1]);
  });  

  Memory.cpuhis = Memory.cpuhis || [];
  Memory.cpuhis.push(Game.cpu.getUsed());

  while (Memory.cpuhis.length > 100) {
    Memory.cpuhis.shift();
  }

  return res;
}

