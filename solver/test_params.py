import json
import time
from ortools.sat.python import cp_model

def is_teacher(p):
    caps = p.get('capabilities', [])
    return 'lead_teacher' in caps or 'foreign_teacher' in caps

def run_solver(symmetry_level=2, num_search_workers=1):
    with open('payload.json', 'r', encoding='utf-8') as f:
        data = json.load(f)

    classes = data.get('classes', [])
    rooms = data.get('rooms', [])
    time_slots = data.get('time_slots', [])
    persons = data.get('persons', [])
    availabilities = data.get('availabilities', [])
    pins = data.get('pins', [])

    model = cp_model.CpModel()
    free_slots = set((a['person_id'], a['time_slot_id']) for a in availabilities)

    assignments = {}
    for c in classes:
        allowed_pids = {perm['person_id'] for perm in c.get('permissions', [])}
        for s in range(c.get('sessions_per_week', 1)):
            for ts in time_slots:
                for r in rooms:
                    for p in persons:
                        if is_teacher(p):
                            if allowed_pids and p['id'] not in allowed_pids:
                                continue
                            if (p['id'], ts['id']) not in free_slots:
                                continue
                            assignments[(c['id'], s, ts['id'], r['id'], p['id'])] = model.NewBoolVar(
                                f"x_c{c['id']}_s{s}_ts{ts['id']}_r{r['id']}_p{p['id']}"
                            )

    for c in classes:
        for s in range(c.get('sessions_per_week', 1)):
            vars_for_session = [
                assignments[(c['id'], s, ts['id'], r['id'], p['id'])]
                for ts in time_slots
                for r in rooms
                for p in persons
                if (c['id'], s, ts['id'], r['id'], p['id']) in assignments
            ]
            if vars_for_session:
                model.AddExactlyOne(vars_for_session)
            else:
                model.Add(0 == 1)

    for ts in time_slots:
        for r in rooms:
            vars_in_room = [
                assignments[(c['id'], s, ts['id'], r['id'], p['id'])]
                for c in classes for s in range(c.get('sessions_per_week', 1))
                for p in persons
                if (c['id'], s, ts['id'], r['id'], p['id']) in assignments
            ]
            if vars_in_room:
                model.AddAtMostOne(vars_in_room)

    for ts in time_slots:
        for p in persons:
            if is_teacher(p):
                vars_for_teacher = [
                    assignments[(c['id'], s, ts['id'], r['id'], p['id'])]
                    for c in classes for s in range(c.get('sessions_per_week', 1))
                    for r in rooms
                    if (c['id'], s, ts['id'], r['id'], p['id']) in assignments
                ]
                if vars_for_teacher:
                    model.AddAtMostOne(vars_for_teacher)

    for pin in pins:
        cid = pin['class_id']
        tsid = pin['time_slot_id']
        rid = pin['room_id']
        class_dict = next((x for x in classes if x['id'] == cid), None)
        if class_dict:
            pinned_vars = [
                assignments[(cid, s, tsid, rid, p['id'])]
                for s in range(class_dict.get('sessions_per_week', 1))
                for p in persons
                if (cid, s, tsid, rid, p['id']) in assignments
            ]
            if pinned_vars:
                model.Add(sum(pinned_vars) >= 1)
            else:
                model.Add(0 == 1)

    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = 30.0
    solver.parameters.symmetry_level = symmetry_level
    solver.parameters.num_search_workers = num_search_workers
    
    start_time = time.time()
    status = solver.Solve(model)
    end_time = time.time()
    
    print(f"symmetry_level={symmetry_level}, workers={num_search_workers} -> status={solver.StatusName(status)}, time={end_time - start_time:.4f}s")

def main():
    print("Testing symmetry_level=0 (no symmetry) and workers=1")
    run_solver(symmetry_level=0, num_search_workers=1)
    
    print("Testing symmetry_level=0 (no symmetry) and workers=4")
    run_solver(symmetry_level=0, num_search_workers=4)

    print("Testing symmetry_level=2 (default) and workers=4")
    run_solver(symmetry_level=2, num_search_workers=4)

if __name__ == '__main__':
    main()
