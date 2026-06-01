import json, math
from datetime import datetime

data = json.load(open('payload.json', encoding='utf-8'))
time_slots = data.get('time_slots', [])
time_slots.sort(key=lambda x: (x['day_of_week'], x['start_time']))

fmt = '%H:%M:%S'
def is_consecutive(ts1, ts2):
    if ts1['day_of_week'] != ts2['day_of_week']: return False
    end1 = datetime.strptime(ts1['end_time'], fmt)
    start2 = datetime.strptime(ts2['start_time'], fmt)
    return end1 == start2

ts_index_to_consecutive = {}
for i, ts in enumerate(time_slots):
    j = i
    while j + 1 < len(time_slots) and is_consecutive(time_slots[j], time_slots[j+1]):
        j += 1
    ts_index_to_consecutive[i] = j - i + 1

for c in data.get('classes', [])[:5]:
    slots_needed = math.ceil(c.get('duration_minutes', 45) / 45.0)
    print(c['code'], c.get('duration_minutes'), slots_needed)

print("Consecutive sequences starting from idx 0:", ts_index_to_consecutive[0])
print("Consecutive sequences starting from idx 5 (10:45-11:30):", ts_index_to_consecutive[5])
