const game = require('./game.js');
const _ = game._;

class CreepGeneralWorker {
  constructor (room, creep) {
    this.creep = creep;
    this.room = room;
  }

  get_job_details () {
    return this.creep.memory.job || null;
  }

  set_job (job, amount) {
    this.creep.memory.job = {
      juid: job.juid,
      amount: amount,
    };
  }

  clear_job () {
    this.creep.memory.job = null;
  }

  get_mode () {
    return this.creep.memory.m || 'i';
  }

  set_mode (mode) {
    this.creep.memory.m = mode;
  }

  set_target (trgt) {
    if (trgt === null) {
      this.creep.memory.t = null;
    } else {
      this.creep.memory.t = trgt.id;
    }
  }

  set_target_id (id) {
    this.creep.memory.t = id;
  }

  get_target (trgt) {
    return game.getObjectById(this.creep.memory.t);
  }

  take_resource_from (trgt, restype, amount) {
    let res = this.creep.harvest(trgt);

    if (res === game.ERR_INVALID_TARGET) {
      res = this.creep.withdraw(trgt, restype, amount);
    }

    if (res == game.ERR_NOT_IN_RANGE) {
      let res2 = this.move_to(trgt);
      if (res2 === game.OK) {
        return res;
      }
      return res2;
    }

    return res;
  }

  move_to (trgt) {
    this.creep.moveTo(trgt);
  }

  debug () {
    if (this.creep.memory.g !== true) {
      return;
    }

    let args = [];

    for (let x = 0; x < arguments.length; ++x) {
      args.push(arguments[x]);
    }

    console.log.apply(console, args);
  }

  put_resource_into (trgt, restype, amount) {
    let res = this.creep.upgradeController(trgt);

    if (res === game.ERR_INVALID_TARGET) {
      res = this.creep.transfer(trgt, restype, amount);
      return res;
    }

    if (res == game.ERR_NOT_IN_RANGE) {
      let res2 = this.move_to(trgt);
      if (res2 === OK) {
        return res;
      }
      return res2;
    }    

    return res;
  }

  got_new_job (job, details) {
    if (this.creep.store.getUsedCapacity(job.rtype) > 0) {
      console.log('going into delivery mode');
      this.set_mode('d');
    } else {
      console.log('going into pickup mode');
      this.set_mode('p');
    }
  }

  get_status() {
    let mode = this.get_mode();
    let details = this.get_job_details();

    if (!details) {
      return 'I have no job details.';
    }
    
    let job = this.room.get_job_by_juid(details.juid);

    let rtype = job.rtype;

    let mpos = this.creep.pos.x + ':' + this.creep.pos.y;

    if (mode == 'p') {
      console.log('$job', job);
      let src = game.getObjectById(job.src);
      return '[' + mpos + '] I am picking up ' + rtype + ' at ' + src;
    } else {
      let dst = game.getObjectById(job.dst);
      return '[' + mpos + '] I am dropping off ' + rtype + ' at ' + dst;
    }
  }

  got_same_job (job, details) {
    let mode = this.get_mode();

    if (mode === 'p') {
      this.debug('pickup for job');
      let src = game.getObjectById(job.src);
      if (this.take_resource_from(src, job.rtype, details.amount) === game.OK) {
        this.clear_job();
      }
    } else {
      this.debug('dropoff for job');
      let dst = game.getObjectById(job.dst);
      if (this.put_resource_into(dst, job.rtype, details.amount) === game.OK) {
        this.room.add_completed_amount_to_job(job, details.amount);
        this.clear_job();
      }
    }
  }

  tick () {
    this.debug('creep gw tick');

    for (let _ = 0; _ < 3; _++) {
      console.log('fetching job info');
      let job_details = this.get_job_details();
      let job = job_details ? this.room.get_job_by_juid(job_details.juid) : null;

      if (job === null) {
        console.log('requesting new job');
        // TODO:
        // Might need to let job selector have function pointer to
        // getFreeCapacity so it can check for various rtype.s
        job = this.room.request_job(this.creep)

        if (job === null) {
          this.debug('no job; no work');
          return;
        }

        this.debug('got new job');
        this.set_job(job, this.creep.store.getFreeCapacity(job.rtype));
        this.got_new_job(job, job_details);
      } else {
        this.debug('got same job');
      }
      
      job_details = this.get_job_details();
      job = job_details ? this.room.get_job_by_juid(job_details.juid) : null;
      this.got_same_job(job, job_details);

      console.log(this.creep.name, this.get_status());
    }
  }
}

module.exports = {
  CreepGeneralWorker: CreepGeneralWorker,
};
