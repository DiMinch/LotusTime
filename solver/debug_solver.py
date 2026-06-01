import json
from ortools.sat.python import cp_model

def is_teacher(p):
    caps = p.get('capabilities', [])
    return 'lead_teacher' in caps or 'foreign_teacher' in caps

def solve_sub(classes, rooms, time_slots, persons, availabilities, pins):
    model = cp_model.CpModel()
    assignments = {}
    for c in classes:
        for s in range(c.get('sessions_per_week', 1)):
            for ts in time_slots:
                for r in rooms:
                    for p in persons:
                        if is_teacher(p):
                            assignments[(c['id'], s, ts['id'], r['id'], p['id'])] = model.NewBoolVar(f"x_c{c['id']}_s{s}_ts{ts['id']}_r{r['id']}_p{p['id']}")

    for c in classes:
        for s in range(c.get('sessions_per_week', 1)):
            model.AddExactlyOne(
                assignments[(c['id'], s, ts['id'], r['id'], p['id'])]
                for ts in time_slots
                for r in rooms
                for p in persons if is_teacher(p)
            )

    for ts in time_slots:
        for r in rooms:
            model.AddAtMostOne(
                assignments[(c['id'], s, ts['id'], r['id'], p['id'])]
                for c in classes for s in range(c.get('sessions_per_week', 1))
                for p in persons if is_teacher(p)
            )

    for ts in time_slots:
        for p in persons:
            if is_teacher(p):
                model.AddAtMostOne(
                    assignments[(c['id'], s, ts['id'], r['id'], p['id'])]
                    for c in classes for s in range(c.get('sessions_per_week', 1))
                    for r in rooms
                )

    free_slots = set((a['person_id'], a['time_slot_id']) for a in availabilities)
    for c in classes:
        for s in range(c.get('sessions_per_week', 1)):
            for ts in time_slots:
                for r in rooms:
                    for p in persons:
                        if is_teacher(p):
                            if (p['id'], ts['id']) not in free_slots:
                                model.Add(assignments[(c['id'], s, ts['id'], r['id'], p['id'])] == 0)

    for pin in pins:
        cid = pin['class_id']
        tsid = pin['time_slot_id']
        rid = pin['room_id']
        class_dict = next((x for x in classes if x['id'] == cid), None)
        if class_dict:
            model.Add(
                sum(
                    assignments[(cid, s, tsid, rid, p['id'])]
                    for s in range(class_dict.get('sessions_per_week', 1))
                    for p in persons if is_teacher(p)
                ) >= 1
            )

    for c in classes:
        allowed_pids = {perm['person_id'] for perm in c.get('permissions', [])}
        if allowed_pids:
            for s in range(c.get('sessions_per_week', 1)):
                for ts in time_slots:
                    for r in rooms:
                        for p in persons:
                            if is_teacher(p):
                                if p['id'] not in allowed_pids:
                                    model.Add(assignments[(c['id'], s, ts['id'], r['id'], p['id'])] == 0)

    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = 2.0
    status = solver.Solve(model)
    return status in [cp_model.OPTIMAL, cp_model.FEASIBLE]

def main():
    with open('payload.json', 'r', encoding='utf-8') as f:
        data = json.load(f)

    classes = data.get('classes', [])
    rooms = data.get('rooms', [])
    time_slots = data.get('time_slots', [])
    persons = data.get('persons', [])
    availabilities = data.get('availabilities', [])
    pins = data.get('pins', [])

    print(f"Total classes to solve: {len(classes)}")

    # Check each class individually
    failed_classes = []
    for c in classes:
        ok = solve_sub([c], rooms, time_slots, persons, availabilities, pins)
        if not ok:
            print(f"Class {c['code']} is individually INFEASIBLE!")
            failed_classes.append(c)
        else:
            pass

    if not failed_classes:
        print("All classes are individually feasible. The conflict is due to global constraints (room/teacher overlaps).")
        
        # Let's find the minimum set of classes that cause infeasibility
        # We can do this by adding classes one by one until it becomes infeasible
        current_classes = []
        for c in classes:
            current_classes.append(c)
            ok = solve_sub(current_classes, rooms, time_slots, persons, availabilities, pins)
            if not ok:
                print(f"Adding class {c['code']} made the model INFEASIBLE!")
                print(f"Classes causing conflict: {[x['code'] for x in current_classes]}")
                break

if __name__ == '__main__':
    main()
