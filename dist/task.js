/*
 * This implements all of the task framework. Priorities are higher if the
 * number is lower. For example, the value -4 is a higher priority than 4.
*/
const game = require('./game');
const _ = game._;

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
    this.set_credit(this.get_credit() - amount);
  }

  transfer (to, amount, maxcap) {
    this.charge(amount);
    return to.credit(amount, maxcap);
  }

  get_tasks () {
    game.memory().tasks = game.memory().tasks || {};
    let tasks = game.memory().tasks;
    return tasks;
  }

  _get_credit () {
    let fname = this.get_full_name();
    let tasks = this.get_tasks();
    if (tasks[fname] === undefined) {
      return 0;
    }
    return tasks[fname];
  }

  _set_credit (amount) {
    let tasks = this.get_tasks();
    let fname = this.get_full_name();
    tasks[fname] = amount;
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
    } else {
      this.set_credit(v + amount);
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

  run () {
    let credit = this.get_credit();
    if (credit <= 0) {
      //console.log(
      //  `task:delayed[${this.get_full_name()}] credit=${credit}`
      //);
      return;
    }

    //console.log(`task:running[${this.get_full_name()}]`);

    try {
      let st = game.cpu().getUsed();
      this.f(this);
      let et = game.cpu().getUsed();
      let dt = et - st;
      this.charge(dt);
      return null;
    } catch (err) {
      console.log(`[error] ${err}`);
      console.log(`${err.stack}`);
      return err;
    }
  }
}

class TaskEngine {
  constructor () {
    this.pend_tasks = [];
    this.root_task = new Task(null, 0, 'root', () => null, null, this);
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
      this.pend_tasks.sort((a, b) => {
        return a.priority > b.priority ? 1 : -1;
      });
      let cur_task = this.pend_tasks.shift();
      let err = cur_task.run();
      if (err) {
        errors.push([cur_task.get_full_name(), err])
      }
    }
    return errors;
  }
}

module.exports.TaskEngine = TaskEngine;
