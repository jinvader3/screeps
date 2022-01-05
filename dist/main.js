const game = require('./game');
const _ = game._;
const { Room } = require('./room');

module.exports.loop = function () {
  console.log('main loop');

  let rooms = {};

  for (let name in game.rooms()) {
    let room = game.rooms()[name];
    if (room.controller !== undefined && room.controller.my) {
      let robj = new Room(room);
      rooms[name] = robj;
    }
  }	

  for (let name in game.creeps()) {
		let creep = game.creeps()[name];
    let parts = name.split(':');
    let rn = parts[0];
    console.log('adding creep ' + name + ' to room ' + rn);
    rooms[rn].add_creep(creep);
	}

  for (let rname in rooms) {
    rooms[rname].tick();
  }
}




