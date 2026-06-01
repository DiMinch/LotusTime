import json, math, scratch_app
from datetime import datetime

data = json.load(open('payload.json', encoding='utf-8'))
status, assignments, solver, classes = scratch_app.test_solve(data)
ts_map = {ts['id']: ts for ts in data['time_slots']}
time_slots = data['time_slots']
time_slots.sort(key=lambda x: (x['day_of_week'], x['start_time']))
tsid_to_idx = {ts['id']: i for i, ts in enumerate(time_slots)}

fmt = '%H:%M:%S'
def is_consecutive(ts1, ts2):
    if ts1['day_of_week'] != ts2['day_of_week']: return False
    end1 = datetime.strptime(ts1['end_time'], fmt)
    start2 = datetime.strptime(ts2['start_time'], fmt)
    return end1 == start2

def get_consecutive_slots(start_idx, num_slots):
    if start_idx + num_slots > len(time_slots): return None
    for i in range(1, num_slots):
        if not is_consecutive(time_slots[start_idx + i - 1], time_slots[start_idx + i]):
            return None
    return [time_slots[start_idx + i]['id'] for i in range(num_slots)]

l01_cid = next(c['id'] for c in classes if c['code'] == 'L01')
result_sessions = []
for (cid, s, tsid, rid, pid), var in assignments.items():
    if solver.Value(var) == 1:
        slots_needed = math.ceil(next((x.get('duration_minutes', 45) for x in classes if x['id'] == cid), 45) / 45.0)
        if slots_needed == 0: slots_needed = 1
        start_idx = tsid_to_idx[tsid]
        block_tsids = get_consecutive_slots(start_idx, slots_needed)
        for bid in block_tsids:
            result_sessions.append((cid, s, bid, rid, pid))

l01_res = [ (s, ts_map[tsid]['start_time'], ts_map[tsid]['day_of_week']) for cid, s, tsid, rid, pid in result_sessions if cid == l01_cid ]
print('L01 result_sessions:', l01_res)
