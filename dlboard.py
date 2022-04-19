from screepsapi import API
import argparse
import json
import os.path

ap = argparse.ArgumentParser()
ap.add_argument('--u', type=str, required=True)
ap.add_argument('--p', type=str, required=True)

args = ap.parse_args()

#api = API(u=args.u, p=args.p, secure=True)

'''
l = []
for x in range(0, 5000, 10):
  t = api.board_list(offset=x, limit=20)['list']
  if len(t) == 0: break
  for item in t:
    l.append(item)
    print(item)
with open('board.json', 'w') as fd:
  fd.write(json.dumps(l))
'''
'''
with open('board.json', 'r') as fd:
  l = json.loads(fd.read())

for item in l:
  user_id = item['user']
  if not os.path.exists('rooms_%s.json' % user_id):
    r = api.user_rooms(user_id, shard='shard3')
    with open('rooms_%s.json' % user_id, 'w') as fd:
      fd.write(json.dumps(r))
    print(r)
'''

with open('board.json', 'r') as fd:
  l = json.loads(fd.read())

p = []

for item in l:
  user_id = item['user']
  if not os.path.exists('rooms_%s.json' % user_id):
    continue
  with open('rooms_%s.json' % user_id, 'r') as fd:
    d = json.loads(fd.read())
    s3 = d['shards']['shard3']
    s2 = d['shards']['shard2']
    s1 = d['shards']['shard1']
    s0 = d['shards']['shard0']
  if len(s0) == 0 and len(s1) == 0 and len(s2) == 0 and len(s3) > 0:
    p.append((item['username'], item['rank']))

p = sorted(p, key=lambda x: x[1])

print('USER GLOBAL-RANK')
for item in p:
  print('%s %s' % (item[0], item[1]))

