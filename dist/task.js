/*
 * This implements all of the task framework. Priorities are higher if the
 * number is lower. For example, the value -4 is a higher priority than 4.
*/
const game = require('./game');
const _ = game._;
const { Stats } = require('./stats');
const { logging } = require('./logging');

class Task {
  constructor (parent, priority, name, f, payer, te) {
    this.parent = parent;
    this.priority = priority;
    this.name = name;
    this.payer = !payer ? this : payer.payer;
    this.f = f;
    this.te = te;
  }

  spawn (priority, name, f) {
    let nt = new Task(this, priority, name, f, this, this.te);
    this.te.queue_task(nt);
    return nt;
  }

  spawn_isolated (priority, name, f) {
    let nt = new Task(this, priority, name, f, null, this.te);
    this.te.queue_task(nt);
    return nt;
  }

  charge (amount) {
    this._avg_charge(amount);
    this.set_credit(this.get_credit() - amount);
  }

  transfer (to, amount, maxcap) {
    let used = to.credit(amount, maxcap);
    this.charge(used);
    return used;
  }

  get_tasks () {
    game.memory().tasks = game.memory().tasks || {};
    let tasks = game.memory().tasks;
    return tasks;
  }

  _avg_charge (amount) {
    const fname = this.get_full_name();
    const tasks = this.get_tasks();
    tasks[fname] = tasks[fname] || {};
    tasks[fname].avgsum = tasks[fname].avgsum || 0;
    tasks[fname].avgcnt = tasks[fname].avgcnt || 0;
    tasks[fname].avgsum += amount;
    tasks[fname].avgcnt += 1;
  }

  _get_credit () {
    let fname = this.get_full_name();
    let tasks = this.get_tasks();
    tasks[fname] = tasks[fname] || {};
    return tasks[fname].amount || 0;
  }

  _set_credit (amount) {
    let tasks = this.get_tasks();
    let fname = this.get_full_name();
    tasks[fname] = tasks[fname] || {};
    tasks[fname].ltick = game.time();
    tasks[fname].amount = amount;
  }

  _tick (delayed) {
    let tasks = this.get_tasks();
    let fname = this.get_full_name();
    tasks[fname] = tasks[fname] || {};
    tasks[fname].tick = (tasks[fname].tick || 0) + 1;
    tasks[fname].delay = (tasks[fname].delay || 0) + (delayed === true ? 0 : 1);
  }

  get_credit () {
    return this.payer._get_credit();
  }

  set_credit (amount) {
    return this.payer._set_credit(amount);
  }

  credit (amount, maxcap) {
    let v = this.get_credit();
    if (v + amount > maxcap) {
      this.set_credit(maxcap);
      return maxcap - v;
    } else {
      this.set_credit(v + amount);
      return amount;
    }
  }

  get_full_name () {
    let parts = [this.name];
    let cur = this.parent;
    while (cur !== null) {
      parts.unshift(cur.name);
      cur = cur.parent;
    }
    return parts.join('/');
  }

  run (stats) {
    let credit = this.get_credit();
    if (credit <= 0) {
      this._tick(true);  
      return;
    }

    try {
      let fn = this.get_full_name();
      let st = game.cpu().getUsed();
      logging.log(`task:running[${fn}]`);
      logging.reset();
      logging.wrapper(fn, () => {
        this.f(this);
      });
      let et = game.cpu().getUsed();
      let dt = et - st;
      this.charge(dt);
      this._tick(false);
      return null;
    } catch (err) {
      logging.log(`[error] ${err}`);
      logging.log(`${err.stack}`);
      return err;
    }
  }
}

class TaskEngine {
  constructor (stats_prefix) {
    this.pend_tasks = [];
    this.root_task = new Task(null, 0, 'root', () => null, null, this);
    this.stats = new Stats(stats_prefix);
  }

  queue_task (task) {
    this.pend_tasks.push(task);
  }

  spawn (priority, name, f) {
    let nt = this.root_task.spawn_isolated(
      priority, name, f
    );
    return nt;
  }

  pending_tasks () {
    return this.pend_tasks.length > 0;
  }

  run_tasks () {
    let errors = []
    while (this.pend_tasks.length > 0) {
      logging.info('executing pending tasks', this.pend_tasks.length);
      this.pend_tasks.sort((a, b) => {
        return a.priority > b.priority ? 1 : -1;
      });
      let cur_task = this.pend_tasks.shift();
      let err = cur_task.run(this.stats);
      if (err) {
        logging.info(`err: ${err}`);
        errors.push([cur_task.get_full_name(), err])
      }
    }
    return errors;
  }

  throw_out_dead_task_meta () {
    game.memory().tasks = game.memory().tasks || {};
    const tasks = game.memory().tasks;
    const ctick = game.time();
    const tnames = [];

    for (let tname in tasks) {
      tnames.push(tname);
    }

    for (let tname of tnames) {
      const meta = tasks[tname];
      if (ctick - meta.ltick > 5) {
        logging.debug('threw out dead task meta', tname);
        delete tasks[tname];
      }
    }
  }
}

module.exports.TaskEngine = TaskEngine;
