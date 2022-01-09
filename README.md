## JInvader3/Screeps

This is a personal Screeps bot.

### Design

The bot uses a task based approach. It uses tasks for error isolation and CPU usage control. Both errors and run-away CPU usage cause important functions not to execute which causes a problem that might only effect the industrial portion of a single room to crash all rooms which is bad. So, isolating different units of code in tasks helps keep errors from propogating or cascading. Also, sometimes code can be buggy or just simply need to be CPU heavy but if left uncontrolled it can cause rooms to crash out by draining the CPU bucket, thus, the entire A.I. starts to fail. To remedy this, the tasks have CPU/credit accounts and these help catch runaway or heavy tasks before they crash everything.

The room is an independent highest level planner. There might be one more level above the room added at a later time. If it is then it will control colonizing new rooms and maybe even expeditions to grab resources out on the highways. Until then, the room controls all functions and the the creeps tick/execute to carry out the orders. The interface between the room and most of the creeps is a decision tree. Other creeps may use a single order simplier form such as : miners.

The decision tree is just an easier more compact way to write a lot of conditional code. It makes mistakes less likely, allows repeating logic easier, and it is a lot easier to view and digest as it is compact. There are two decision trees. One for grabbing energy and another for putting it somewhere.

In the future, industry will begin with labs, extractors, and factories. At this stage, the decision tree may or may not be optimal. I am going to try to make it work. Right now it is generic over any type of resource. I might have to switch to a more precise order based system in which specific amounts of resources are ordered to be moved from place to place and the decision tree has an entry to allow creeps to enter into that mode.

At the moment, the spawning code is simple/noop like. This will work for the time being but very soon it will be upgraded to a more complex planner. This will involve all parts of the code putting in orders for creeps instead of communicating directly with the spawner. Then, a very low priority task (running last of all tasks) will evaluate the build requests, select the best next build to spawn, and begin spawning it. The planner (low priority task) will be able to look and see which creeps are most important, which are about to die, and determine the best way to keep the room from crashing.

#### What is a room crash?

If you don't know. A room crash isn't just when the code fails with an error or does not execute. It also involves failure of the room to reach its objective. A good example of a room crash that may not be obvious is when all the creeps happen to die because the spawner couldn't replace them fast enough. This is in effect almost the same as if the A.I./script simply stopped running for some amount of time- thus I call it a crash.
