import screepsapi
import json
import os.path

user = 'jeffredbeard7@gmail.com'
pw = 'LBL6PDWiq2Jq93L'

class MySocket(screepsapi.Socket):
  def set_subscriptions(self):
    print('doing subscriptions')
    self.subscribe_user('console')
    self.subscribe('room:shard3/E53S13')

  def process_log(self, ws, msg, shard):
    print('log', msg)

  def process_error(self, ws, msg, shard):
    print('err', msg)  

  def process_room_object(self, ws, obj_id, obj, room, shard):
    print(room, shard, obj)

    if not os.path.exists('%s.txt' % room):
      print('creating new room file')
      with open('%s.txt' % room, 'w') as fd:
        for y in range(0, 40):
          fd.write('.' * 40)
          fd.write('\n')

    print('writing to existing room file')
    with open('%s.txt' % room, 'w+') as fd:
      fd.seek(obj['x'] + obj['y'] * 41)
      fd.write('X')  

  #def process_message(self, ws, msg):
  #  msg = json.loads(msg)
  #  print(msg)

ws = MySocket(user, pw, secure=True)
ws.start()

