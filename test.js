const test = require('ava');
const main = require('./dist/main.js');
const { Room } = require('./dist/room.js');
const game = require('./dist/game.js');
const _ = game._;

class GhostCreep {
  constructor (name) {
    this.name = name;
    this.memory = memory;
  }
}

class GhostStore {
  constructor () {
    this.res = {};
  }

  set_resource (rtype, amount, capacity) {
    this.res[rtype] = {
      amount: amount,
      capacity: capacity,
    };
    return this;
  }

  getFreeCapacity (rtype) {
    if (this.res[rtype] === undefined) {
      return 0;
    }
    return this.res[rtype].capacity - this.res[rtype].amount;
  }

  getUsedCapacity (rtype) {
    if (this.res[rtype] === undefined) {
      return 0;
    }
    return this.res[rtype].amount;
  }
}

class GhostSource {
  constructor (id) {
    this.id = id;
    this.__type = 'source';
    this.store = new GhostStore();
  }
}

class GhostSpawn {
  constructor (id) {
    this.id = id;
    this.__type = 'spawn';
    this.store = new GhostStore();
  }

  spawnCreep (parts, name, memory) {
  }
}

class GhostRoom {
  constructor (name) {
    this.name = name;
    this.objs = {};
    this.memory = {};
  }

  add_object (obj) {
    this.objs[obj.id] = obj;
  }

  find (what) {
    let out = [];

    _.each(this.objs, obj => {
      if (what == game.FIND_MY_SPAWNS && obj.__type === 'spawn') {
        out.push(obj);
      } else if (what == game.FIND_SOURCES && obj.__type === 'source') {
        out.push(obj);
      }
    });

    return out;
  }
}

test('Room:general1', t => {
  let room = new Room(new GhostRoom('E34N32'));
  // Test it works without adding anything.
  room.tick();
  t.pass();
});

test('Room:general2', t => {
  let groom = new GhostRoom('E34N32');
  groom.add_object(new GhostSource('xmns2'));
  groom.add_object(new GhostSource('mxjs1'));
  groom.add_object(new GhostSpawn('sp32'));
  room = new Room(groom);
  t.truthy(room.spawns.length == 1);
  t.truthy(room.sources.length == 2);
  room.spawns[0].store.set_resource(game.RESOURCE_ENERGY, 0, 100);
  room.tick();
  console.log('room.jobs', room.jobs);
  // No jobs created because the source had no energy.
  t.truthy(room.jobs.length == 0);
  t.pass();
});

test('Room:general3', t => {
  let groom = new GhostRoom('E34N32');
  groom.add_object(new GhostSource('xmns2'));
  groom.add_object(new GhostSource('mxjs1'));
  groom.add_object(new GhostSpawn('sp32'));
  room = new Room(groom);
  t.truthy(room.spawns.length == 1);
  t.truthy(room.sources.length == 2);
  room.spawns[0].store.set_resource(game.RESOURCE_ENERGY, 0, 100);
  room.sources[0].store.set_resource(game.RESOURCE_ENERGY, 50, 100);
  room.sources[1].store.set_resource(game.RESOURCE_ENERGY, 50, 100);
  room.tick();
  console.log('room.jobs', room.jobs);
  // No jobs created because the source had no energy.
  t.truthy(room.jobs.length == 2);
  t.pass();
});

test('Room:creep1', t => {
  let c0 = new GhostCreep('E32N32:29392932');
  c0.tick();
  t.pass();
));

/*
test('bar', async t => {
  // t.fail()
  // t.pass()
  const bar = Promise.resolve('bar');
  t.is(await bar, 'bar');
});
*/
