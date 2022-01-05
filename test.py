import screepsapi
import json
import os.path
import argparse
import curses
import time
import logging
import threading
import queue

class MySocket(screepsapi.Socket):
  def __init__(self, user, pw, eque):
    super().__init__(user=user, password=pw, secure=True)
    self.eque = eque

  def set_subscriptions(self):
    self.subscribe_user('console')
    self.subscribe('room:shard3/E53S13')

  def process_log(self, ws, msg, shard):
    self.eque.put({ 'topic': 'log', 'msg': msg, 'shard': shard })

  def process_error(self, ws, msg, shard):
    self.eque.put({ 'topic': 'log', 'msg': msg, 'shard': shard })

  def process_room_object(self, ws, obj_id, obj, room, shard):
    self.eque.put({
      'topic': 'obj', 
      'id': obj_id, 
      'obj': obj, 
      'room': room, 
      'shard': shard
    })

class Program:
  def __init__(self, win, user, pw):
    self.win = win
    #curses.noecho()
    #curses.cbreak()
    #self.stdscr.keypad(True)
    #self.stdscr.start_color()
    self.cpanel = 'help'
    self.panels = ['help', 'log', 'room'] 
    self.cpanels_ndx = 0
    self.user = user
    self.pw = pw
    self.log = []
    self.objs_by_room = {}
    
  def cleanup(self):
    curses.nocbreak()
    self.win.keypad(False)
    curses.echo()

  def input_entry(self, event_que):
    while True:
      key = self.win.getkey()
      event_que.put({ 'topic': 'key', 'key': key })

  def main(self):
    event_que = queue.Queue()

    ws = MySocket(self.user, self.pw, event_que)
    wsth = threading.Thread(target=ws.start)
    wsth.start()

    ith = threading.Thread(target=self.input_entry, args=(event_que,))
    ith.start()

    while True:
      if self.cpanel == 'help':
        self.show_panel_help()
      elif self.cpanel == 'log':
        self.show_panel_log()
      elif self.cpanel == 'room':
        self.show_panel_room()
      self.win.refresh()

      e = event_que.get()

      if e['topic'] != 'key':
          if e['topic'] == 'log':
              self.log.append(e['msg'])
          elif e['topic'] == 'obj':
              xid = e['shard'] + ':' + e['room']
              self.objs_by_room[xid] = self.objs_by_room.get(xid, {})
              self.objs_by_room[xid][e['id']] = e['obj']
          continue

      logging.info('%s' % e)
      key = e['key']

      logging.info('key: ' + key)

      if key == 'q':
        return
      elif key == 'a':
        self.cpanels_ndx = (self.cpanels_ndx - 1) % len(self.panels)
        self.cpanel = self.panels[self.cpanels_ndx]
        logging.info('cpanel changes to %s' % self.cpanel)
      elif key == 'd':
        self.cpanels_ndx = (self.cpanels_ndx + 1) % len(self.panels)
        self.cpanel = self.panels[self.cpanels_ndx]
        logging.info('cpanel changes to %s' % self.cpanel)

  def show_panel_bar(self):
    items = [
      'HELP',
      'LOG',
      'ROOM',
    ]

    pstr = []
    for i in items:
      if self.cpanel == i.lower():
        pstr.append('[%s]' % i)
      else:
        pstr.append('%s' % i)
    pstr = ' '.join(pstr)

    self.win.addstr(0, 0, pstr)

  def show_panel_help(self):
    self.win.clear()
    self.show_panel_bar()
    self.win.addnstr(2, 0, 'Welcome to the Help panel.', 40)

  def show_panel_log(self):
    self.win.clear()
    self.show_panel_bar()

    log_sect = self.log[-20:][::-1]

    for x in range(0, len(log_sect)):
        msg = log_sect[x]
        self.win.addnstr(1 + x, 0, msg, 40)

  def show_panel_room(self):
    self.win.clear()
    self.show_panel_bar()
    # self.objs_by_room['<shard>:<room>']['<objid>'] = obj


  def object_update(self, obj_id, obj, room, shard):
    pass

def main(win, args):
  args = args[0]

  logging.info(args)
  logging.info('a')
  logging.info('b')
  
  win.addnstr(1, 0, 'ok:' + str(win), 10)
  win.refresh()

  try:
   
    logging.info('c')

    p = Program(
      win = win,
      user = args.user,
      pw = args.pw
    )

    p.main()
  except Exception as e:
    logging.warning('[EXCEPTION]')
    logging.warning(str(e))

if __name__ == '__main__':
  logging.basicConfig(
    filename='log.txt', 
    filemode='w', 
    level=logging.INFO
  )
  logging.info('Logging has started.')
  ap = argparse.ArgumentParser()
  ap.add_argument('--user', type=str, required=True)
  ap.add_argument('--pw', type=str, required=True)
  args = ap.parse_args()
  curses.wrapper(main, args=(args,))
