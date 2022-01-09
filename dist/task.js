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
    this.payer = payer;
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
    let cur = this.get_payer();
    cur.set_credit(cur.get_credit() - amount);
  }

  transfer (to, amount) {
    this.charge(amount);
    return to.set_credit(to.get_credit() + amount);
  }

  get_payer() {
    let cur = this;
    while (cur.payer !== null) {
      cur = cur.payer;
    }
    return cur;
  }

  get_tasks () {
    game.memory().tasks = game.memory().tasks || {};
    let tasks = game.memory().tasks;
    return tasks;
  }

  get_credit () {
    return this.get_payer()._get_credit();
  }

  _get_credit () {
    let fname = this.get_full_name();
    let tasks = this.get_tasks();
    if (tasks[fname] === undefined) {
      return 0;
    }
    return tasks[fname];
  }

  set_credit (amount) {
    return this.get_payer()._set_credit(amount);
  }

  _set_credit (amount) {
    let tasks = this.get_tasks();
    let fname = this.get_full_name();
    tasks[fname] = amount;
  }

  credit (amount, maxcap) {
    return this.get_payer()._credit(amount, maxcap);
  }

  _credit (amount, maxcap) {
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
    if (this.get_credit() <= 0) {
      console.log(`task:delayed[${this.get_full_name()}]`);
      return;
    }

    console.log(`task:running[${this.get_full_name()}]`);

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
    let nt = this.root_task.spawn(
      priority, name, f
    );
    return nt;
  }

  pending_tasks () {
    return this.pend_tasks.length > 0;
  }

  run_tasks () {
    while (this.pend_tasks.length > 0) {
      this.pend_tasks.sort((a, b) => {
        return a.priority > b.priority ? 1 : -1;
      });
      let cur_task = this.pend_tasks.shift();
      cur_task.run();
    }
  }
}

module.exports.TaskEngine = TaskEngine;
