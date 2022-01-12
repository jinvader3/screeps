const test = require('ava');
const main = require('./main');
const { Room } = require('./room');
const { CreepGeneralWorker } = require('./creepgw');
const { CreepFighter } = require('./creepfighter');
const { CreepMiner } = require('./creepminer');
const { TaskEngine } = require('./task');
const { CreepClaimer } = require('./creepclaimer');
const { CreepDummy } = require('./creepdummy');
const game = require('./game');
const _ = game._;

test('creep_iface', t => {
  // Ensure each creep sub-type has the proper interface.
  let c;

  let room = {};
  let base_creep = {
    name: 'test',
  };

  let clazzes = [
    CreepGeneralWorker, 
    CreepFighter, 
    CreepMiner,
    CreepClaimer,
    CreepDummy,
  ];

  _.each(clazzes, clazz => {
    let c = new clazz(room, base_creep);
    console.log('testing', clazz, typeof c.get_pos);
    t.truthy(c.get_name() === base_creep.name);
    t.truthy(typeof c.tick === 'function');
    t.truthy(typeof c.get_pos === 'function');
  });

  t.pass();
});

test('bootup', t => {
  game.memory().creeps = {};
  game.memory().creeps['E32S87:apple'] = {
    c: 'gw',
    g: 'worker',
  };

  game.creeps()['E32S87:apple'] = {
    memory: game.memory().creeps['E32S87:apple'],
    name: 'E32S87:apple',
    store: {
      getUsedCapacity: type => {
        t.truthy(type === game.RESOURCE_ENERGY);
        return 1;
      },
    },
    pos: {
      findClosestByPath: objs => {
        return objs[0];
      },
    },
  };

  game.memory().rooms = {
    'E32S87': {},
  };

  let a = false;
  let b = false;
  let c = false;

  game.rooms()['E32S87'] = {
    controller: {
      my: true,
    },
    memory: game.memory().rooms['E32S87'],
    spawns: [
      {
        spawnCreep: () => {
          return game.OK;
        },
      },
    ],
    containers: [
    ],
    sources: [
    ],
    find: (code) => {
      switch (code) {
        case game.FIND_MY_SPAWNS: return game.rooms()['E32S87'].spawns;
        case game.FIND_SOURCES: return game.rooms()['E32S87'].sources;
        case game.FIND_HOSTILE_CREEPS: return [];
        case game.FIND_CONSTRUCTION_SITES: return [];
        case game.FIND_STRUCTURES: return [{
            structureType: game.STRUCTURE_ROAD,
            hits: 0,
            hitsMax: 100,
        }];
      }
    },
  };

  game.setGetObjectByIdTrampoline(id => {
    switch (id) {
      case 's1': return game.rooms()['E32S87'].sources[0];
      default: throw new Error(`unknown id ${id}`);
    }
  });

  main.loop();
  t.pass();
});

test('tasks:singletask', t => {
  let te = new TaskEngine();
  let a = false;
  let task = te.spawn(0, 'apple', task => {
    a = true;
  });
  task.credit(1);
  te.run_tasks();
  t.truthy(a);
  t.pass();
});

test('tasks:creditandcharge', t => {
  let te = new TaskEngine();
  let a = false;
  let b = false;
  let c = false;
  let task;

  task = te.spawn(0, 'apple', task => {
    game.cpu().setUsed(9);
    a = true;
  });

  task.credit(10);
  te.run_tasks();
  t.truthy(a);

  task = te.spawn(0, 'apple', task => {
    game.cpu().setUsed(10);
    b = true;
  });

  te.run_tasks();
  t.truthy(b);

  task = te.spawn(0, 'apple', task => {
    c = true;
  });
  
  te.run_tasks();
  t.truthy(!c);

  t.pass();
});

test('tasks:indepchildcredit', t => {
  // Test that the parent will execute with credit but the
  // independent child (isolated) will not execute because it
  // now has its own credit account which is zero. Next, set
  // the child to some amount using a transfer.
  let te = new TaskEngine();
  let a = false;
  let b = false;
  let task;

  task = te.spawn(0, 'apple', task => {
    task.spawn_isolated(0, 'isolated_apple', () => {
      b = true;
    });
    game.cpu().setUsed(5);
    a = true;
  });

  task.credit(10);
  te.run_tasks();
  t.truthy(a && !b);

  a = false;
  b = false;

  task = te.spawn(0, 'apple', task => {
    let ctask = task.spawn_isolated(0, 'isolated_apple', () => {
      b = true;
    });

    // Take 10 credits from task and give to ctask.
    task.transfer(ctask, 10, 20);
    game.cpu().setUsed(5);
    a = true;
  });

  te.run_tasks();
  t.truthy(a && b);

  a = false;
  b = false;

  task = te.spawn(0, 'apple', task => {
    let ctask = task.spawn_isolated(0, 'isolated_apple', () => {
      b = true;
    });
    // Take 10 credits from task and give to ctask.
    task.transfer(ctask, 20, 20);
    game.cpu().setUsed(5);
    a = true;
  });

  te.run_tasks();
  t.truthy(!a && !b);
  // It should have a deficit. That is the cost of the transfer
  // and the run-time.
  t.truthy(task.get_credit() === -5);

  t.pass();
});

test('tasks:childtaskandpriority', t => {
  let te = new TaskEngine();
  let a = false;
  let b = false;
  let c = false;
  let d = 0;
  let e = false;
  let task = te.spawn(0, 'apple', task => {
    a = d++;
    task.spawn(0, 'grape', ctask => {
      b = d++;
    });
    task.spawn(1, 'fox', ctask => {
      c = d++;
    });
    task.spawn(-1, 'turtle', ctask => {
      e = d++;
    });
  });
  
  task.credit(1);
  t.truthy(te.pending_tasks());
  te.run_tasks();
  t.truthy(!te.pending_tasks());
  t.truthy(a === 0);
  t.truthy(e === 1);
  t.truthy(b === 2);
  t.truthy(c === 3); 
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
