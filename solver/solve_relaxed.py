import json
from ortools.sat.python import cp_model

def is_teacher(p):
    caps = p.get('capabilities', [])
    return 'lead_teacher' in caps or 'foreign_teacher' in caps

def main():
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

    # 1. Variables
    assignments = {}
    for c in classes:
        allowed_pids = {perm['person_id'] for perm in c.get('permissions', [])}
        for s in range(c.get('sessions_per_week', 1)):
            for ts in time_slots:
                for r in rooms:
                    for p in persons:
                        if is_teacher(p):
                            # Filter 1: class permissions
                            if allowed_pids and p['id'] not in allowed_pids:
                                continue
                            # Filter 2: teacher availability
                            if (p['id'], ts['id']) not in free_slots:
                                continue
                            
                            assignments[(c['id'], s, ts['id'], r['id'], p['id'])] = model.NewBoolVar(
                                f"x_c{c['id']}_s{s}_ts{ts['id']}_r{r['id']}_p{p['id']}"
                            )

    # 2. Slack Variables for C1
    slacks = {}
    for c in classes:
        for s in range(c.get('sessions_per_week', 1)):
            slacks[(c['id'], s)] = model.NewBoolVar(f"slack_{c['id']}_s{s}")

    # C1: Each class session must be scheduled exactly once (or slack is 1)
    for c in classes:
        for s in range(c.get('sessions_per_week', 1)):
            vars_for_session = [
                assignments[(c['id'], s, ts['id'], r['id'], p['id'])]
                for ts in time_slots
                for r in rooms
                for p in persons
                if (c['id'], s, ts['id'], r['id'], p['id']) in assignments
            ]
            model.Add(sum(vars_for_session) + slacks[(c['id'], s)] == 1)

    # C2: Room capacity (At most one class per room per timeslot)
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

    # C3: Teacher availability (At most one class per teacher per timeslot)
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

    # C5: Respect Pins (can be relaxed or not, let's keep it relaxed as well)
    pin_slacks = {}
    for i, pin in enumerate(pins):
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
            pin_slacks[i] = model.NewBoolVar(f"pin_slack_{i}")
            model.Add(sum(pinned_vars) + pin_slacks[i] >= 1)

    # Objective: Minimize total unscheduled sessions (slacks) + pin violations
    model.Minimize(
        sum(slacks.values()) + sum(pin_slacks.values())
    )

    print(f"Total variables: {len(assignments)}")
    print(f"Total slacks: {len(slacks)}")

    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = 30.0
    solver.parameters.log_search_progress = True
    solver.parameters.cp_model_presolve = False
    status = solver.Solve(model)

    print("Status:", solver.StatusName(status))
    print(solver.ResponseStats())
    if status in [cp_model.OPTIMAL, cp_model.FEASIBLE]:
        unscheduled = []
        for (cid, s), slack_var in slacks.items():
            if solver.Value(slack_var) == 1:
                c = next(x for x in classes if x['id'] == cid)
                unscheduled.append(f"{c['code']} session {s}")
        
        print(f"Total unscheduled sessions: {len(unscheduled)} / {len(slacks)}")
        if unscheduled:
            print("Unscheduled list:")
            for item in unscheduled:
                print("  -", item)
        else:
            print("All sessions were scheduled! The model is feasible but search took too long!")

        # Print pinned violations
        for i, pin in enumerate(pins):
            if i in pin_slacks and solver.Value(pin_slacks[i]) == 1:
                c = next(x for x in classes if x['id'] == pin['class_id'])
                print(f"Pin violated: Class {c['code']} at slot {pin['time_slot_id']}")

if __name__ == '__main__':
    main()
