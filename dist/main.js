const game = require('./game');
const _ = game._;
const { Room } = require('./room');
const { TaskEngine } = require('./task');
const { Stats } = require('./stats');
const { logging } = require('./logging');
const { guimenu } = require('./guimenu');

module.exports.rooms = {};

module.exports.loop = function () {
  if (game.shard === undefined || game.shard().name !== 'shard3') {
    return;
  }

  let rooms = {};
  module.exports.rooms = rooms;

  let extra_config = {
    'E57S33': {
        /*
        claimteam: [
          {
            tr: 'E59S32',
          },
        ],
        */ 
        /*'warfare_small': [
          {
            uid: 'ironspear',
            room: 'E59S33',
            max_level: 6,
            count: 1,
          },
        ],
        'remote_sources': [
          {
            uid: 'apple',
            mining_level: 3,
            hauling_power: 5,
            sources: [
              {
                sid: '5bbcb06f9099fc012e63c2ce',
                room: 'E56S33',
              },
            ],
          },
          {
            uid: 'grape',
            mining_level: 3,
            hauling_power: 5,
            sources: [
              {
                sid: '5bbcb0819099fc012e63c486',
                room: 'E57S32',
              },
            ],
          },
        ],*/
    },
  };

  let creep_deaths = [];

  logging.info('creating rooms');
  for (let name in game.rooms()) {
    let room = game.rooms()[name];
    if (room.controller !== undefined && room.controller.my) {
      //console.log('@room obj made', name);
      let robj = new Room(room, extra_config[name] || {});
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
    let task = te.spawn(0, `room:${rname}`, task => {
      rooms[rname].tick(task);
    });

    // Each tick give 4 CPU and a bucket maximum of 10 CPU.
    task.credit(7, 10);
  }

  let res = te.run_tasks();

  _.each(res, stat => {
    console.log(stat[0], stat[1]);
  });  

  let stats = new Stats();

  stats.record_stat('cpu.bucket', game.cpu().bucket);
  stats.record_stat('cpu.used', game.cpu().getUsed());

  return res;
}

