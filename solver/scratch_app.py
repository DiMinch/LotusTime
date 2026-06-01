import math
from datetime import datetime
from ortools.sat.python import cp_model
import json

def test_solve(data):
    classes = data.get('classes', [])
    rooms = data.get('rooms', [])
    time_slots = data.get('time_slots', [])
    persons = data.get('persons', [])
    availabilities = data.get('availabilities', [])
    pins = data.get('pins', [])

    def is_teacher(p):
        caps = p.get('capabilities', [])
        return 'lead_teacher' in caps or 'foreign_teacher' in caps
    teachers = [p for p in persons if is_teacher(p)]

    model = cp_model.CpModel()
    free_slots = set((a['person_id'], a['time_slot_id']) for a in availabilities)

    fmt = '%H:%M:%S'
    def is_consecutive(ts1, ts2):
        if ts1['day_of_week'] != ts2['day_of_week']: return False
        end1 = datetime.strptime(ts1['end_time'], fmt)
        start2 = datetime.strptime(ts2['start_time'], fmt)
        return end1 == start2

    time_slots.sort(key=lambda x: (x['day_of_week'], x['start_time']))
    
    def get_consecutive_slots(start_idx, num_slots):
        if start_idx + num_slots > len(time_slots): return None
        for i in range(1, num_slots):
            if not is_consecutive(time_slots[start_idx + i - 1], time_slots[start_idx + i]):
                return None
        return [time_slots[start_idx + i]['id'] for i in range(num_slots)]

    tsid_to_idx = {ts['id']: i for i, ts in enumerate(time_slots)}
    
    room_ts_coverage = { (ts['id'], r['id']): [] for ts in time_slots for r in rooms }
    teacher_ts_coverage = { (ts['id'], p['id']): [] for ts in time_slots for p in persons if is_teacher(p) }

    assignments = {}
    for c in classes:
        slots_needed = math.ceil(c.get('duration_minutes', 45) / 45.0)
        if slots_needed == 0: slots_needed = 1
        
        allowed_pids = {perm['person_id'] for perm in c.get('permissions', [])}
        for s in range(c.get('sessions_per_week', 1)):
            for i, ts in enumerate(time_slots):
                block_tsids = get_consecutive_slots(i, slots_needed)
                if not block_tsids:
                    continue
                
                for r in rooms:
                    for p in teachers:
                        if allowed_pids and p['id'] not in allowed_pids:
                            continue
                        
                        teacher_free = all((p['id'], tid) in free_slots for tid in block_tsids)
                        if not teacher_free:
                            continue
                        
                        var = model.NewBoolVar(f"x_c{c['id']}_s{s}_ts{ts['id']}_r{r['id']}_p{p['id']}")
                        assignments[(c['id'], s, ts['id'], r['id'], p['id'])] = var
                        
                        for tid in block_tsids:
                            room_ts_coverage[(tid, r['id'])].append(var)
                            teacher_ts_coverage[(tid, p['id'])].append(var)

    for c in classes:
        for s in range(c.get('sessions_per_week', 1)):
            vars_for_session = [
                var for (cid, sid, tsid, rid, pid), var in assignments.items()
                if cid == c['id'] and sid == s
            ]
            if vars_for_session:
                model.AddExactlyOne(vars_for_session)
            else:
                model.Add(0 == 1)

    for (tid, rid), vars_in_room in room_ts_coverage.items():
        if vars_in_room:
            model.AddAtMostOne(vars_in_room)

    for (tid, pid), vars_for_teacher in teacher_ts_coverage.items():
        if vars_for_teacher:
            model.AddAtMostOne(vars_for_teacher)

    for pin in pins:
        cid = pin['class_id']
        tsid = pin['time_slot_id']
        rid = pin['room_id']
        
        covering_vars = []
        for (acid, sid, atsid, arid, apid), var in assignments.items():
            if acid == cid and arid == rid:
                slots_needed = math.ceil(next((x.get('duration_minutes', 45) for x in classes if x['id'] == acid), 45) / 45.0)
                if slots_needed == 0: slots_needed = 1
                start_idx = tsid_to_idx[atsid]
                block_tsids = get_consecutive_slots(start_idx, slots_needed)
                if block_tsids and tsid in block_tsids:
                    covering_vars.append(var)
        
        if covering_vars:
            model.Add(sum(covering_vars) >= 1)
        else:
            print(f"[Solver Warning] Pin for class {cid} at slot {tsid} and room {rid} is impossible!")
            model.Add(0 == 1)

    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = 10.0
    status = solver.Solve(model)
    return status, assignments, solver, classes

if __name__ == "__main__":
    data = json.load(open('payload.json', encoding='utf-8'))
    status, assignments, solver, classes = test_solve(data)
    print("Status:", status)
    if status in [cp_model.OPTIMAL, cp_model.FEASIBLE]:
        # Print a few assignments
        for (cid, sid, tsid, rid, pid), var in list(assignments.items()):
            if solver.Value(var) == 1:
                class_code = next(c['code'] for c in classes if c['id'] == cid)
                slots_needed = math.ceil(next(c.get('duration_minutes', 45) for c in classes if c['id'] == cid) / 45.0)
                print(f"Assigned {class_code} session {sid} starting at {tsid} (needs {slots_needed} slots)")
