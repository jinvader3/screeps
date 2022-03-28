## JInvader3/Screeps

This is a personal Screeps bot.

### Design

#### Tasks

The bot uses a task based approach. It uses tasks for error isolation and CPU usage control. Both errors and run-away CPU usage cause important functions not to execute which causes a problem that might only effect the industrial portion of a single room to crash all rooms which is bad. So, isolating different units of code in tasks helps keep errors from propogating or cascading. Also, sometimes code can be buggy or just simply need to be CPU heavy but if left uncontrolled it can cause rooms to crash out by draining the CPU bucket, thus, the entire A.I. starts to fail. To remedy this, the tasks have CPU/credit accounts and these help catch runaway or heavy tasks before they crash everything.

#### Room Planner

The room is an independent highest level planner. There might be one more level above the room added at a later time. If it is then it will control colonizing new rooms and maybe even expeditions to grab resources out on the highways. Until then, the room controls all functions and the the creeps tick/execute to carry out the orders. The interface between the room and most of the creeps is a decision tree. Other creeps may use a single order simplier form such as : miners.

#### Decision Tree

The decision tree is just an easier more compact way to write a lot of conditional code. It makes mistakes less likely, allows repeating logic easier, and it is a lot easier to view and digest as it is compact. There are two decision trees. One for grabbing energy and another for putting it somewhere.

#### Spawn Management Task

The spawning code started as a simple no-operation type loop. It just built the first thing to be requested. This made it biased to order of calls for creating a creep which is bad. The spawning code now runs as a task and has its own API for which parts of the code base call when needing to create a creep. The spawn task runs as a low priority so it is one of the very last tasks to run and at this point it reviews all of the creep spawn requests and chooses the highest priority. It also ignores repeated requests for the same creep _until_ that creep is near to dying. This allows creeps to roll out of the spawn as soon as the creep it is replacing dies. It also prevents other creep production from blocking higher priority creep production.

#### Industry

The industry is currently implemented but only supports three labs. It will be trivial to support all fix. I had to stop working on the code base for a little while so I was not able to finish the implemented. It currently does market scans, determines the most profitable product the produce, buys anything it needs, and creates it. Then sells what it has to maintain a certain number of credits.

_I currently have it coded to build things at a small loss in credits!_

#### What is a room crash?

If you don't know. A room crash isn't just when the code fails with an error or does not execute. It also involves failure of the room to reach its objective. A good example of a room crash that may not be obvious is when all the creeps happen to die because the spawner couldn't replace them fast enough. This is in effect almost the same as if the A.I./script simply stopped running for some amount of time- thus I call it a crash.

One of the challenges of keeping your creeps going is not letting the rooms crash by having any starvation or blocking of needed facilities such as your spawn. Or, having any logic problems where all your energy gets dumped somewhere and there is not enough to run for example your spawn, upgrade your controller before it downgrades, and so forth. I call these events room crashes because the end result is usually an empty room with no creeps.
