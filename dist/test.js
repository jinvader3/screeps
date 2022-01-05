const test = require('ava');
const main = require('./main');
const { Room } = require('./room');
const { CreepGeneralWorker } = require('./creepgw');
const game = require('./game');
const _ = game._;

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
    rtype = rtype || game.RESOURCE_ENERGY;
    if (this.res[rtype] === undefined) {
      return 0;
    }
    return this.res[rtype].capacity - this.res[rtype].amount;
  }

  getUsedCapacity (rtype) {
    rtype = rtype || game.RESOURCE_ENERGY;
    if (this.res[rtype] === undefined) {
      return 0;
    }
    return this.res[rtype].amount;
  }
}

class GhostRoomPosition {
  constructor (x, y, room_name) {
    this.roomName = room_name;
    this.x = x;
    this.y = y;
  }
}

class GhostCreep {
  constructor (name, room) {
    this.name = name;
    this.memory = {};
    this.store = new GhostStore();
    this.pos = new GhostRoomPosition(0, 0, room.name);
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
  let room = new GhostRoom('E32N32');

  let job = {
      src: 'xmn2',
      dst: 'sp32',
      rtype: game.RESOURCE_ENERGY,
      amount: 100,
      juid: '3029302932:392232',
  };

  let mxjs1 = new GhostSource('mxjs1');
  let xmn2 = new GhostSource('xmn2');
  let sp32 = new GhostSpawn('sp32');

  room.request_job = (free_cap) => job;
  room.get_job_by_juid = (juid) => job;
  room.add_completed_amount_to_job = () => undefined;

  let c0 = new GhostCreep('E32N32:29392932', room);

  c0.memory.g = true;

  let harvest_called = false;
  let move_to_called = false;

  c0.harvest = (trgt) => {
    harvest_called = true;
    return game.ERR_NOT_IN_RANGE;
  };

  c0.moveTo = (trgt) => {
    move_to_called = true;
    return game.OK;
  };

  c0.upgradeController = (trgt) => game.OK;

  let g0 = new CreepGeneralWorker(room, c0);

  let f = (id) => {
    console.log('$id', id);
    switch (id) {
      case 'xmn2': return xmn2; 
      case 'sp32': return sp32;
      case 'mxjs1': t.fail();
    }
    t.fail();
  };

  game.setGetObjectByIdTrampoline(f);
  g0.tick();

  t.truthy(harvest_called && move_to_called);

  c0.harvest = (trgt) => {
    c0.store.set_resource(job.rtype, 100, 100);
    return game.OK;
  };

  g0.tick();
  t.pass();
});

/*
test('bar', async t => {
  // t.fail()
  // t.pass()
  const bar = Promise.resolve('bar');
  t.is(await bar, 'bar');
});
*/
