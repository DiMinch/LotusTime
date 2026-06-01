import json
from ortools.sat.python import cp_model

def is_teacher(p):
    caps = p.get('capabilities', [])
    return 'lead_teacher' in caps or 'foreign_teacher' in caps

def solve_with_flags(use_pins=True, use_permissions=True):
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
        allowed_pids = {perm['person_id'] for perm in c.get('permissions', [])} if use_permissions else set()
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
                return "INFEASIBLE_VAR_EMPTY"

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

    if use_pins:
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
                    return "INFEASIBLE_PIN_IMPOSSIBLE"

    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = 5.0
    status = solver.Solve(model)
    return solver.StatusName(status)

def main():
    print("1. Solve with ALL constraints:", solve_with_flags(use_pins=True, use_permissions=True))
    print("2. Solve WITHOUT pins:", solve_with_flags(use_pins=False, use_permissions=True))
    print("3. Solve WITHOUT permissions:", solve_with_flags(use_pins=True, use_permissions=False))
    print("4. Solve WITHOUT pins and permissions:", solve_with_flags(use_pins=False, use_permissions=False))

if __name__ == '__main__':
    main()
