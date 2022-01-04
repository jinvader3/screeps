if (global['_'] === undefined) {
  global['_'] = require('../lodash-core-outer.js');
}

const Room = require('./room.js');
const CreepGeneralWorker = require('./creepgw.js');
const CreepDummy = require('./creepdummy.js');

module.exports.loop = function () {
  console.log('main loop');

  let rooms = {};

  for (let name in Game.rooms) {
    let room = Game.rooms[name];
    if (room.controller !== undefined && room.controller.my) {
      let robj = new Room(room);
      rooms[name] = robj;
    }
  }	

  for (let name in Game.creeps) {
		let creep = Game.creeps[name];
    let parts = name.split(':');
    let rn = parts[0];
    console.log('adding creep ' + name + ' to room ' + rn);
    rooms[rn].add_creep(creep);
	}

  for (let rname in rooms) {
    rooms[rname].tick();
  }
}




