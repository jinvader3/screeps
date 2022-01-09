const game = require('./game');
const _ = game._;
const { Room } = require('./room');
const { TaskEngine } = require('./task');

module.exports.loop = function () {
  console.log('main loop');

  let rooms = {};

  for (let name in game.memory().creeps) {
    if (game.creeps()[name] === undefined) {
      delete game.memory().creeps[name];
    }
  }

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
    rooms[rn].add_creep(creep);
	}

  let te = new TaskEngine();

  for (let rname in rooms) {
    te.spawn(0, `room:{rname}`, task => {
      rooms[rname].tick(task);
    });
  }

  while (te.pending_tasks()) {
    te.run_tasks();
  }
}




