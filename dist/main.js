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
    console.log('@room', room);
    if (room.controller !== undefined && room.controller.my) {
      console.log('@room obj made', name);
      let robj = new Room(room);
      rooms[name] = robj;
    }
  }	

  for (let name in game.creeps()) {
		let creep = game.creeps()[name];
    let parts = name.split(':');
    let rn = parts[0];

    console.log('adding creep to room', rn);
    
    if (rooms[rn] !== undefined) {
      // If controller is lost this could happen. Not sure
      // the best behavior. But, for now, this prevents the
      // failure of the entire script.
      console.log('creep added to room');
      rooms[rn].add_creep(creep);
    }
	}

  let te = new TaskEngine();

  for (let rname in rooms) {
    let task = te.spawn(0, `room:${rname}`, task => {
      rooms[rname].tick(task);
    });

    // Each tick give 4 CPU and a bucket maximum of 10 CPU.
    task.credit(4, 10);
  }

  while (te.pending_tasks()) {
    te.run_tasks();
  }
}




