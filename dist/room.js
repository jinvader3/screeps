const game = require('./game.js');
_ = game._;

class Room {
  constructor (room) {
    this.room = room;
    this.creeps = [];
    this.spawns = room.find(game.FIND_MY_SPAWNS);
    this.sources = room.find(game.FIND_SOURCES);
    this.room.memory.mi = this.room.memory.mi || {};
    this.room.memory.jobs = this.room.memory.jobs || [];
    this.jobs = this.room.memory.jobs;
    this.room.memory.jobs_uid = this.room.memory.jobs_uid || 0;
    this.breq = [];
  }

  request_build_creep (ruid, body_unit, unit_min, unit_max, clazz, priority) {
    if (!_.some(this.breq, breq => if (breq.ruid === ruid) {
      breq.body_unit = body_unit;
      breq.unit_min = unit_min;
      breq.unit_max = unit_max;
      breq.clazz = clazz;
      breq.priority = priority;
      return true;
    } else { return false })) {
      this.breq.push({
        ruid: ruid,
        body_unit: body_unit,
        unit_min: unit_min,
        unit_max: unit_max,
        clazz: clazz,
        priority: priority,
      });
    }
  }

  think_build_creep () {
  }

  add_creep (creep) {
    if (creep.memory.c == 'gw') {
      creep = new CreepGeneralWorker(this, creep);
    } else {
      creep.memory.c = 'gw';
      creep = new CreepDummy(this, creep);
    }

    this.creeps.push(creep);
  }

  tick () {
    console.log('ticking for room');

    if (this.creeps.length < 10 && this.spawns.length > 0) {
      console.log('trying to spawn creep');
      //this.spawns[0].spawnCreep(
      //  [game.WORK, game.CARRY, game.MOVE, game.MOVE],
      //  this.room.name + ':' + game.time(),
      //  {
      //    'c': 'gw',
      //  }
      //);
      //
    }

    console.log('creating jobs for room');
 
    _.each(this.sources, source => {
      _.each(this.spawns, spawn => {
        let outstanding = this.sum_uncompleted_rtype_amount_for_dst(
          spawn, game.RESOURCE_ENERGY
        );
        
        console.log('outstanding', outstanding);
        
        let delta = spawn.store.getFreeCapacity(game.RESOURCE_ENERGY) - outstanding;
        
        console.log('delta', delta);

        let most = this.sum_uncomitted_rtype_amount_for_src(
          source, game.RESOURCE_ENERGY
        );

        if (Math.min(most, delta) > 0) {
          // Don't overcommit. Just wait for it to be handy.
          this.add_job_rmove(
            source, spawn, game.RESOURCE_ENERGY, 
            Math.min(most, delta)
          );
        }
      });

      if (this.room.controller && this.room.controller.my) {
        if (this.sum_uncompleted_rtype_amount_for_dst(
          this.room.controller, game.RESOURCE_ENERGY) < 1000) {
            this.add_job_rmove(
              source, this.room.controller, game.RESOURCE_ENERGY,
              // Only commit what is actually here.
              this.sum_uncomitted_rtype_amount_for_src(
                source, game.RESOURCE_ENERGY
              )
            );
        }
      }
    });

    console.log('listing jobs');

    _.each(this.jobs, job => {
      console.log('job', job.type, job.src, job.dst, job.rtype, job.amount);
    });

    console.log('iterating creeps', this.creeps.length);

    for (let ndx in this.creeps) {
      let creep = this.creeps[ndx];
      creep.tick();
    }
  }

  count_source_spots (src) {
    let spots = this.room.lookAtArea(
      src.pos.y - 1, src.pos.x - 1, src.pos.y + 1, src.pos.x + 1
    );

    let count = 0;
    for (let _y = -1; _y < 2; ++_y) {
      for (let _x = -1; _x < 2; ++_x) {
        let x = _x + src.pos.x;
        let y = _y + src.pos.y;

        if (spots[y] === undefined) continue;

        let spot = spots[y][x];
  
        if (spot === undefined) continue;
  
        spot = _.filter(spot, item => item.type !== 'creep');
  
        if (spot.length > 1) continue;
        if (spot[0].terrain === 'plain') {
          count++;
        }
      }
    }
    
    return count;
  }

  get_source_spots (src) {
    this.room.memory.ssc = this.room.memory.ssc || {};
    if (this.room.memory.ssc[src.id] === undefined) {
      this.room.memory.ssc[src.id] = this.count_source_spots(src);
    }
    return this.room.memory.ssc[src.id];
  }

  count_jobs_for_source (src) {
    let jobs = _.filter(this.jobs, job => job.src == src.id);
    return jobs.length;
  }

  sum_uncompleted_rtype_amount_for_dst (dst, rtype) {
    let jobs = _.filter(this.jobs, job => job.dst == dst.id);
    jobs = _.filter(jobs, job => job.rtype == rtype);
    return _.sumBy(jobs, job => {
      return job.amount - this.sum_completed_amount_for_job(job);
    });
  }

  count_rtype_jobs_for_source (src, rtype) {
    let jobs = _.filter(this.jobs, job => job.src === src.id);
    jobs = _.filter(jobs, job => job.rtype == rtype);
    return _.sumBy(jobs, job => {
      return job.amount - this.sum_uncompleted_amount_for_job(job);
    });
  }

  sum_completed_amount_for_job (job) {
    let completed = _.filter(job.events, e => e.type == 'complete');
    return _.sumBy(completed, e => e.amount);
  }

  add_completed_amount_to_job (job, amount) {
    job.events.push({ type: 'completed', amount: amount });
  }

  sum_uncomitted_rtype_amount_for_src (src, rtype) {
    let have = src.store.getUsedCapacity(rtype);
    let jobs = _.filter(this.jobs, job => job.src === src.id);
    jobs = _.filter(jobs, job => job.rtype === rtype);
    let committed = _.sumBy(jobs, job => job.amount);
    return have - committed;
  }

  sum_uncompleted_amount_for_job (job) {
    let completed = this.sum_completed_amount_for_job(job);
    return job.amount - completed;
  }

  sum_taken_amount_for_job (job) {
    return _.sumBy(this.creeps, creep => {
      let details = creep.get_job_details();
      if (details === null) {
        return 0;
      }
      if (details.juid === job.juid) {
        return details.amount;
      }
      return 0;
    });
  }

  sum_net_amount_for_job (job) {
    let a = this.sum_completed_amount_for_job(job);
    let b = this.sum_taken_amount_for_job(job);
    return job.amount - a - b;
  }

  get_next_job_uid () {
    return game.time() + ':' + this.room.memory.jobs_uid++;
  }


  request_job (creep) {
    let jobs = _.filter(this.jobs, job => {
      let a = this.sum_net_amount_for_job(job);
      return a > 0;
    });

    const store = creep.store;

    console.log('@@@', store.getUsedCapacity(game.RESOURCE_ENERGY));

    let delivery_jobs = 
      _.filter(jobs, job => store.getUsedCapacity(job.rtype) > 0);

    let job;
  
    if (delivery_jobs.length > 0) {
      console.log('handing out delivery job');
      job = _.sample(delivery_jobs);
    } else {
      job = _.sample(jobs);
    }

    if (job === undefined)
      return null;
 
    return {
      src: job.src,
      dst: job.dst,
      rtype: job.rtype,
      amount: Math.min(capacity, job.amount),
      juid: job.juid,
    }
  }

  get_job_by_juid (juid) {
    return _.find(this.jobs, job => job.juid === juid);
  }

  add_job_rmove (job_src, job_dst, rtype, amount) {
    console.log('adding new job');
    this.jobs.push({
      type: 'rmove',
      src: job_src.id,
      dst: job_dst.id,
      rtype: rtype,
      amount: amount,
      juid: this.get_next_job_uid(), 
      events: [],
    });
  }

}

module.exports.Room = Room;
