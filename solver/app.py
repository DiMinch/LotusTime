import os
import math
from datetime import datetime
from flask import Flask, request, jsonify
from flask_cors import CORS
from ortools.sat.python import cp_model
import traceback

app = Flask(__name__)
CORS(app)

@app.route('/')
def index():
    return jsonify({"message": "LotusTime OR-Tools Solver Service is running."})

@app.route('/solve', methods=['POST'])
def solve():
    data = request.get_json()
    if not data:
        return jsonify({"status": "error", "message": "No data provided"}), 400
        
    try:
        classes = data.get('classes', [])
        rooms = data.get('rooms', [])
        time_slots = data.get('time_slots', [])
        persons = data.get('persons', [])
        availabilities = data.get('availabilities', [])
        pins = data.get('pins', [])
        constraints = data.get('constraints', [])

        print(f"[Solver Debug] Classes: {len(classes)}, Rooms: {len(rooms)}, Time Slots: {len(time_slots)}, Persons: {len(persons)}, Availabilities: {len(availabilities)}, Pins: {len(pins)}, Constraints: {len(constraints)}", flush=True)
        
        # Count teachers
        def is_teacher(p):
            caps = p.get('capabilities', [])
            return 'lead_teacher' in caps or 'foreign_teacher' in caps

        def matches_period(start_time_str, period):
            try:
                hour = int(start_time_str.split(':')[0])
                if period == 'morning':
                    return hour < 12
                elif period == 'afternoon':
                    return 12 <= hour < 18
                elif period == 'evening':
                    return hour >= 18
            except Exception:
                pass
            return False

        def constraint_applies_to_slot(c_detail, ts):
            days = c_detail.get('day_of_week', [])
            days_int = []
            for d in days:
                try: days_int.append(int(d))
                except: pass
            if days_int and ts['day_of_week'] not in days_int:
                return False
            period = c_detail.get('time_period')
            if period and not matches_period(ts['start_time'], period):
                return False
            return True
        teachers = [p for p in persons if is_teacher(p)]
        print(f"[Solver Debug] Teachers with capability: {len(teachers)}", flush=True)

        model = cp_model.CpModel()
        
        # --- Pre-process Time Slots for Durations ---
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
        
        free_slots = set((a['person_id'], a['time_slot_id']) for a in availabilities)

        # 1. Variables (Segment-aware)
        session_vars = {}  # maps (c_id, s, start_ts_id, r_id) -> BoolVar
        assign_vars = {}   # maps (c_id, s, start_ts_id, r_id, seg_idx, p_id) -> BoolVar
        ta_assign_vars = {} # maps (c_id, s, start_ts_id, r_id, seg_idx, p_id) -> BoolVar

        # Count teachers
        def is_teacher(p):
            caps = p.get('capabilities', [])
            return 'lead_teacher' in caps or 'foreign_teacher' in caps

        teachers = [p for p in persons if is_teacher(p)]
        print(f"[Solver Debug] Teachers with capability: {len(teachers)}", flush=True)

        model = cp_model.CpModel()
        
        # --- Pre-process Time Slots for Durations ---
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
        teacher_ts_coverage = { (ts['id'], p['id']): [] for ts in time_slots for p in persons }
        
        free_slots = set((a['person_id'], a['time_slot_id']) for a in availabilities)

        # 1. Variables & Assignments
        for c in classes:
            c_segs = c.get('segments')
            if not c_segs:
                c_segs = [{
                    "label": "Phân đoạn chính",
                    "duration_minutes": c.get('duration_minutes', 45),
                    "required_capability": "lead_teacher_or_foreign"
                }]
            
            # Calculate slots for each segment
            seg_slots = []
            for seg in c_segs:
                dur = seg.get('duration_minutes', 45)
                slots = math.ceil(dur / 45.0)
                if slots == 0: slots = 1
                seg_slots.append(slots)
            
            total_slots_needed = sum(seg_slots)
            allowed_pids = {perm['person_id'] for perm in c.get('permissions', [])}
            
            for s in range(c.get('sessions_per_week', 1)):
                for i, ts in enumerate(time_slots):
                    block_tsids = get_consecutive_slots(i, total_slots_needed)
                    if not block_tsids:
                        continue
                    
                    for r in rooms:
                        # Verify candidate teachers for all segments
                        seg_candidates = []
                        impossible = False
                        
                        for seg_idx, seg in enumerate(c_segs):
                            seg_start_offset = sum(seg_slots[0:seg_idx])
                            seg_len = seg_slots[seg_idx]
                            seg_tsids = block_tsids[seg_start_offset : seg_start_offset + seg_len]
                            
                            required_cap = seg.get('required_capability')
                            if not required_cap or required_cap == 'any':
                                required_cap = 'lead_teacher_or_foreign'
                                
                            candidates = []
                            for p in persons:
                                p_caps = p.get('capabilities', [])
                                if required_cap == 'lead_teacher_or_foreign':
                                    if 'lead_teacher' not in p_caps and 'foreign_teacher' not in p_caps:
                                        continue
                                else:
                                    if required_cap not in p_caps:
                                        continue
                                
                                if allowed_pids and p['id'] not in allowed_pids:
                                    continue
                                
                                if not all((p['id'], tid) in free_slots for tid in seg_tsids):
                                    continue
                                    
                                candidates.append(p)
                                
                            if not candidates:
                                impossible = True
                                break

                            # TA capability logic for this segment
                            required_ta_cap = seg.get('required_ta_capability')
                            ta_candidates = []
                            if required_ta_cap and required_ta_cap != 'none':
                                for p in persons:
                                    p_caps = p.get('capabilities', [])
                                    if required_ta_cap not in p_caps:
                                        continue
                                    if allowed_pids and p['id'] not in allowed_pids:
                                        continue
                                    if not all((p['id'], tid) in free_slots for tid in seg_tsids):
                                        continue
                                    ta_candidates.append(p)
                                if not ta_candidates:
                                    impossible = True
                                    break
                                    
                            seg_candidates.append((seg_idx, seg_tsids, candidates, required_ta_cap, ta_candidates))
                            
                        if impossible:
                            continue
                            
                        # Create session variable
                        s_var = model.NewBoolVar(f"session_c{c['id']}_s{s}_ts{ts['id']}_r{r['id']}")
                        session_vars[(c['id'], s, ts['id'], r['id'])] = s_var
                        
                        # Add to room coverage
                        for tid in block_tsids:
                            room_ts_coverage[(tid, r['id'])].append(s_var)
                            
                        # Create segment assignment variables
                        for seg_idx, seg_tsids, candidates, required_ta_cap, ta_candidates in seg_candidates:
                            seg_assign_vars = []
                            for p in candidates:
                                a_var = model.NewBoolVar(f"assign_c{c['id']}_s{s}_ts{ts['id']}_r{r['id']}_seg{seg_idx}_p{p['id']}")
                                assign_vars[(c['id'], s, ts['id'], r['id'], seg_idx, p['id'])] = a_var
                                seg_assign_vars.append(a_var)
                                
                                # Add to teacher coverage
                                for tid in seg_tsids:
                                    teacher_ts_coverage[(tid, p['id'])].append(a_var)
                                    
                            # Link segment assignment to session active status
                            model.Add(sum(seg_assign_vars) == s_var)

                            # Handle TA assignment if required
                            if required_ta_cap and required_ta_cap != 'none':
                                seg_ta_assign_vars = []
                                for p in ta_candidates:
                                    ta_var = model.NewBoolVar(f"assign_ta_c{c['id']}_s{s}_ts{ts['id']}_r{r['id']}_seg{seg_idx}_p{p['id']}")
                                    ta_assign_vars[(c['id'], s, ts['id'], r['id'], seg_idx, p['id'])] = ta_var
                                    seg_ta_assign_vars.append(ta_var)
                                    
                                    # Add to teacher coverage (TA is busy)
                                    for tid in seg_tsids:
                                        teacher_ts_coverage[(tid, p['id'])].append(ta_var)
                                        
                                # Link TA segment assignment to session active status
                                model.Add(sum(seg_ta_assign_vars) == s_var)

                                # Prevent main teacher and TA from being the same person
                                for p in persons:
                                    main_has = any(x['id'] == p['id'] for x in candidates)
                                    ta_has = any(x['id'] == p['id'] for x in ta_candidates)
                                    if main_has and ta_has:
                                        m_var = assign_vars[(c['id'], s, ts['id'], r['id'], seg_idx, p['id'])]
                                        t_var = ta_assign_vars[(c['id'], s, ts['id'], r['id'], seg_idx, p['id'])]
                                        model.Add(m_var + t_var <= s_var)

        print(f"[Solver Debug] Number of CP-SAT session variables: {len(session_vars)}, assignment variables: {len(assign_vars)}", flush=True)

        # 2. Hard Constraints
        # C1: Each class session must be scheduled exactly once
        for c in classes:
            for s in range(c.get('sessions_per_week', 1)):
                vars_for_session = [
                    var for (cid, sid, tsid, rid), var in session_vars.items()
                    if cid == c['id'] and sid == s
                ]
                if vars_for_session:
                    model.AddExactlyOne(vars_for_session)
                else:
                    print(f"[Solver Warning] Class {c['code']} session {s} has no possible teacher/timeslot assignments!")
                    model.Add(0 == 1)

        # C2: Room capacity (At most one class per room per timeslot)
        for (tid, rid), vars_in_room in room_ts_coverage.items():
            if vars_in_room:
                model.AddAtMostOne(vars_in_room)

        # C3: Teacher availability (At most one class per teacher per timeslot)
        for (tid, pid), vars_for_teacher in teacher_ts_coverage.items():
            if vars_for_teacher:
                model.AddAtMostOne(vars_for_teacher)

        # C5: Respect Pins
        for pin in pins:
            cid = pin['class_id']
            tsid = pin['time_slot_id']
            rid = pin['room_id']
            
            covering_vars = []
            for (acid, sid, atsid, arid), var in session_vars.items():
                if acid == cid and arid == rid:
                    c_dict = next(x for x in classes if x['id'] == acid)
                    c_segs = c_dict.get('segments')
                    if not c_segs:
                        c_segs = [{"duration_minutes": c_dict.get('duration_minutes', 45)}]
                    total_slots = sum(math.ceil(seg.get('duration_minutes', 45) / 45.0) or 1 for seg in c_segs)
                    
                    start_idx = tsid_to_idx[atsid]
                    block_tsids = get_consecutive_slots(start_idx, total_slots)
                    if block_tsids and tsid in block_tsids:
                        covering_vars.append(var)
            
            if covering_vars:
                model.Add(sum(covering_vars) >= 1)
            else:
                print(f"[Solver Warning] Pin for class {cid} at slot {tsid} and room {rid} is impossible!")
                model.Add(0 == 1)

        # C6: Sessions of the same class must be on different days unless allow_same_day is True
        for c in classes:
            if not c.get('allow_same_day', False) and c.get('sessions_per_week', 1) > 1:
                # Group slots by day
                slots_by_day = {}
                for ts in time_slots:
                    day = ts['day_of_week']
                    if day not in slots_by_day:
                        slots_by_day[day] = []
                    slots_by_day[day].append(ts['id'])
                
                for day, day_tsids in slots_by_day.items():
                    vars_on_day = [
                        var for (cid, s, tsid, rid), var in session_vars.items()
                        if cid == c['id'] and tsid in day_tsids
                    ]
                    if vars_on_day:
                        model.Add(sum(vars_on_day) <= 1)

        # C7: Special constraints from user
        for c_data in constraints:
            ctype = c_data.get('constraint_type')
            subject_person = c_data.get('subject_person', '')
            details = c_data.get('details', {})
            
            if not ctype or not subject_person:
                continue
            
            subjects = [s.strip() for s in subject_person.split(',') if s.strip()]
            
            # --- HELPER: SET VARS TO 0 FOR AN OVERLAPPING SLOT ---
            def set_zero_if_overlap(entity_type, entity_id, ts):
                if entity_type in ['room', 'class']:
                    for (cid, s, atsid, arid), var in session_vars.items():
                        match = False
                        if entity_type == 'room' and arid == entity_id:
                            match = True
                        elif entity_type == 'class' and cid == entity_id:
                            match = True
                            
                        if match:
                            c_dict = next(x for x in classes if x['id'] == cid)
                            c_segs = c_dict.get('segments')
                            if not c_segs:
                                c_segs = [{"duration_minutes": c_dict.get('duration_minutes', 45)}]
                            total_slots = sum(math.ceil(seg.get('duration_minutes', 45) / 45.0) or 1 for seg in c_segs)
                            
                            start_idx = tsid_to_idx[atsid]
                            block_tsids = get_consecutive_slots(start_idx, total_slots)
                            if block_tsids and ts['id'] in block_tsids:
                                model.Add(var == 0)
                elif entity_type == 'person':
                    for (cid, s, atsid, arid, seg_idx, apid), var in assign_vars.items():
                        if apid == entity_id:
                            c_dict = next(x for x in classes if x['id'] == cid)
                            c_segs = c_dict.get('segments')
                            if not c_segs:
                                c_segs = [{"duration_minutes": c_dict.get('duration_minutes', 45)}]
                            
                            seg_slots = []
                            for seg in c_segs:
                                dur = seg.get('duration_minutes', 45)
                                slots = math.ceil(dur / 45.0)
                                if slots == 0: slots = 1
                                seg_slots.append(slots)
                                
                            seg_start_offset = sum(seg_slots[0:seg_idx])
                            seg_len = seg_slots[seg_idx]
                            
                            total_slots = sum(seg_slots)
                            start_idx = tsid_to_idx[atsid]
                            block_tsids = get_consecutive_slots(start_idx, total_slots)
                            if block_tsids:
                                seg_tsids = block_tsids[seg_start_offset : seg_start_offset + seg_len]
                                if ts['id'] in seg_tsids:
                                    model.Add(var == 0)

            # 1. UNAVAILABLE
            if ctype == 'unavailable':
                for sub in subjects:
                    person_ids = [p['id'] for p in persons if p['short_name'].lower() == sub.lower()]
                    room_ids = [r['id'] for r in rooms if r['name'].lower() == sub.lower()]
                    class_ids = [c['id'] for c in classes if c['code'].lower() == sub.lower()]
                    
                    for ts in time_slots:
                        if constraint_applies_to_slot(details, ts):
                            for pid in person_ids:
                                set_zero_if_overlap('person', pid, ts)
                            for rid in room_ids:
                                set_zero_if_overlap('room', rid, ts)
                            for cid in class_ids:
                                set_zero_if_overlap('class', cid, ts)

            # 2. MORNING ONLY
            elif ctype == 'morning_only':
                for sub in subjects:
                    person_ids = [p['id'] for p in persons if p['short_name'].lower() == sub.lower()]
                    room_ids = [r['id'] for r in rooms if r['name'].lower() == sub.lower()]
                    class_ids = [c['id'] for c in classes if c['code'].lower() == sub.lower()]
                    
                    for ts in time_slots:
                        days = details.get('day_of_week', [])
                        days_int = []
                        for d in days:
                            try: days_int.append(int(d))
                            except: pass
                        day_matches = (not days_int) or (ts['day_of_week'] in days_int)
                        
                        if day_matches and not matches_period(ts['start_time'], 'morning'):
                            for pid in person_ids:
                                set_zero_if_overlap('person', pid, ts)
                            for rid in room_ids:
                                set_zero_if_overlap('room', rid, ts)
                            for cid in class_ids:
                                set_zero_if_overlap('class', cid, ts)

            # 3. AFTERNOON ONLY
            elif ctype == 'afternoon_only':
                for sub in subjects:
                    person_ids = [p['id'] for p in persons if p['short_name'].lower() == sub.lower()]
                    room_ids = [r['id'] for r in rooms if r['name'].lower() == sub.lower()]
                    class_ids = [c['id'] for c in classes if c['code'].lower() == sub.lower()]
                    
                    for ts in time_slots:
                        days = details.get('day_of_week', [])
                        days_int = []
                        for d in days:
                            try: days_int.append(int(d))
                            except: pass
                        day_matches = (not days_int) or (ts['day_of_week'] in days_int)
                        
                        if day_matches and not matches_period(ts['start_time'], 'afternoon'):
                            for pid in person_ids:
                                set_zero_if_overlap('person', pid, ts)
                            for rid in room_ids:
                                set_zero_if_overlap('room', rid, ts)
                            for cid in class_ids:
                                set_zero_if_overlap('class', cid, ts)

            # 4. AVOID OVERLAP
            elif ctype == 'avoid_overlap':
                class_ids = [c['id'] for c in classes if any(c['code'].lower() == sub.lower() for sub in subjects)]
                if len(class_ids) > 1:
                    for ts in time_slots:
                        covering_vars = []
                        for (cid, s, atsid, arid), var in session_vars.items():
                            if cid in class_ids:
                                c_dict = next(x for x in classes if x['id'] == cid)
                                c_segs = c_dict.get('segments')
                                if not c_segs:
                                    c_segs = [{"duration_minutes": c_dict.get('duration_minutes', 45)}]
                                total_slots = sum(math.ceil(seg.get('duration_minutes', 45) / 45.0) or 1 for seg in c_segs)
                                
                                start_idx = tsid_to_idx[atsid]
                                block_tsids = get_consecutive_slots(start_idx, total_slots)
                                if block_tsids and ts['id'] in block_tsids:
                                    covering_vars.append(var)
                        if covering_vars:
                            model.Add(sum(covering_vars) <= 1)

            # 5. SAME SESSION
            elif ctype == 'same_session':
                class_ids = [c['id'] for c in classes if any(c['code'].lower() == sub.lower() for sub in subjects)]
                if len(class_ids) > 1:
                    c_dicts = [next(c for c in classes if c['id'] == cid) for cid in class_ids]
                    min_sessions = min(c.get('sessions_per_week', 1) for c in c_dicts)
                    
                    for s in range(min_sessions):
                        for ts in time_slots:
                            class_vars = []
                            for cid in class_ids:
                                vars_for_class_session_ts = [
                                    var for (acid, asid, atsid, arid), var in session_vars.items()
                                    if acid == cid and asid == s and atsid == ts['id']
                                ]
                                class_vars.append(sum(vars_for_class_session_ts))
                            
                            for idx in range(len(class_vars) - 1):
                                model.Add(class_vars[idx] == class_vars[idx + 1])

            # 6. MAX SESSIONS
            elif ctype == 'max_sessions':
                max_count = details.get('max_count')
                if max_count is not None:
                    try:
                        max_val = int(max_count)
                        for sub in subjects:
                            person_ids = [p['id'] for p in persons if p['short_name'].lower() == sub.lower()]
                            for pid in person_ids:
                                person_sessions = []
                                for (cid, s, atsid, arid) in session_vars.keys():
                                    session_p_vars = [
                                        var for (acid, asid, a_atsid, a_arid, seg_idx, apid), var in assign_vars.items()
                                        if acid == cid and asid == s and a_atsid == atsid and a_arid == arid and apid == pid
                                    ]
                                    if session_p_vars:
                                        has_p = model.NewBoolVar(f"has_p_{cid}_{s}_{atsid}_{arid}_{pid}")
                                        model.Add(sum(session_p_vars) >= has_p)
                                        model.Add(has_p <= sum(session_p_vars))
                                        person_sessions.append(has_p)
                                if person_sessions:
                                    model.Add(sum(person_sessions) <= max_val)
                    except Exception:
                        pass

            # 7. ROOM ASSIGNMENT
            elif ctype == 'room_assignment':
                room_name = details.get('room_name', '')
                if room_name:
                    allowed_room_ids = [r['id'] for r in rooms if r['name'].lower() == room_name.lower()]
                    if allowed_room_ids:
                        for sub in subjects:
                            class_ids = [c['id'] for c in classes if c['code'].lower() == sub.lower()]
                            is_foreign = (sub.lower() in ["giáo viên nước ngoài", "foreign teacher", "foreign_teacher"])
                            person_ids = [p['id'] for p in persons if p['short_name'].lower() == sub.lower()]
                            
                            for (cid, s, tsid, rid), var in session_vars.items():
                                if rid not in allowed_room_ids:
                                    if cid in class_ids:
                                        model.Add(var == 0)
                            
                            for (cid, s, tsid, rid, seg_idx, pid), var in assign_vars.items():
                                if rid not in allowed_room_ids:
                                    match = False
                                    if pid in person_ids:
                                        match = True
                                    elif is_foreign:
                                        person_dict = next((p for p in persons if p['id'] == pid), None)
                                        if person_dict and 'foreign_teacher' in person_dict.get('capabilities', []):
                                            match = True
                                    if match:
                                        model.Add(var == 0)

        # --- Preference: Teachers should stay in the same room within the same half-day session ---
        room_use_vars = {}
        day_periods = set()
        for ts in time_slots:
            day = ts['day_of_week']
            for per in ['morning', 'afternoon', 'evening']:
                if matches_period(ts['start_time'], per):
                    day_periods.add((day, per))
                    break

        for p in persons:
            for (day, per) in day_periods:
                for r in rooms:
                    key = (p['id'], day, per, r['id'])
                    room_use_vars[key] = model.NewBoolVar(f"room_use_{p['id']}_{day}_{per}_{r['id']}")

        for (cid, s, tsid, rid, seg_idx, pid), var in assign_vars.items():
            ts = next(x for x in time_slots if x['id'] == tsid)
            day = ts['day_of_week']
            per = 'morning'
            for p_name in ['morning', 'afternoon', 'evening']:
                if matches_period(ts['start_time'], p_name):
                    per = p_name
                    break
            
            key = (pid, day, per, rid)
            if key in room_use_vars:
                model.Add(var <= room_use_vars[key])

        # Preference: Pack classes into the earliest slots of morning/afternoon/evening
        def get_slot_period_penalty(ts):
            try:
                hour = int(ts['start_time'].split(':')[0])
                minute = int(ts['start_time'].split(':')[1])
                total_minutes = hour * 60 + minute
                if hour < 12: # Morning (starts at 07:00 / 420 mins)
                    return max(0, (total_minutes - 420) // 45)
                elif 12 <= hour < 18: # Afternoon (starts at 13:30 / 810 mins)
                    return max(0, (total_minutes - 810) // 45)
                else: # Evening (starts at 18:00 / 1080 mins)
                    return max(0, (total_minutes - 1080) // 45)
            except Exception:
                return 0

        objective_terms = []
        # Primary objective: minimize teacher room switches (weight = 100)
        for var in room_use_vars.values():
            objective_terms.append(100 * var)

        # Secondary objective: minimize delay penalty (weight = 1)
        for (cid, s, tsid, rid), var in session_vars.items():
            ts = next(x for x in time_slots if x['id'] == tsid)
            penalty = get_slot_period_penalty(ts)
            if penalty > 0:
                objective_terms.append(penalty * var)

        model.Minimize(sum(objective_terms))

        # 3. Solve
        solver = cp_model.CpSolver()
        solver.parameters.max_time_in_seconds = 15
        solver.parameters.symmetry_level = 0
        solver.parameters.num_search_workers = 4
        
        status = solver.Solve(model)

        if status in [cp_model.OPTIMAL, cp_model.FEASIBLE]:
            result_sessions = []
            for (cid, s, tsid, rid, seg_idx, pid), var in assign_vars.items():
                if solver.Value(var) == 1:
                    c_dict = next(x for x in classes if x['id'] == cid)
                    c_segs = c_dict.get('segments')
                    if not c_segs:
                        c_segs = [{"duration_minutes": c_dict.get('duration_minutes', 45)}]
                    
                    seg_slots = []
                    for seg in c_segs:
                        dur = seg.get('duration_minutes', 45)
                        slots = math.ceil(dur / 45.0)
                        if slots == 0: slots = 1
                        seg_slots.append(slots)
                        
                    seg_start_offset = sum(seg_slots[0:seg_idx])
                    seg_len = seg_slots[seg_idx]
                    
                    total_slots = sum(seg_slots)
                    start_idx = tsid_to_idx[tsid]
                    block_tsids = get_consecutive_slots(start_idx, total_slots)
                    
                    if block_tsids:
                        seg_tsids = block_tsids[seg_start_offset : seg_start_offset + seg_len]
                        role = c_segs[seg_idx].get('required_capability', 'lead_teacher')
                        if not role or role == 'any':
                            role = 'lead_teacher'
                            
                        # Look up TA assignment
                        ta_pid = None
                        ta_role = None
                        for (t_cid, t_s, t_tsid, t_rid, t_seg_idx, t_pid), t_var in ta_assign_vars.items():
                            if t_cid == cid and t_s == s and t_tsid == tsid and t_rid == rid and t_seg_idx == seg_idx:
                                if solver.Value(t_var) == 1:
                                    ta_pid = t_pid
                                    ta_role = c_segs[seg_idx].get('required_ta_capability')
                                    break
                                    
                        for bid in seg_tsids:
                            sess = {
                                "class_id": cid,
                                "session_index": s,
                                "time_slot_id": bid,
                                "room_id": rid,
                                "teacher_id": pid,
                                "role": role
                            }
                            if ta_pid:
                                sess["ta_id"] = ta_pid
                                sess["ta_role"] = ta_role
                            result_sessions.append(sess)
            
            return jsonify({
                "status": "optimal" if status == cp_model.OPTIMAL else "feasible",
                "solved_count": len(result_sessions),
                "sessions": result_sessions
            })
        else:
            return jsonify({
                "status": "infeasible",
                "message": "Could not find a valid schedule with the given constraints."
            })
            
    except Exception as e:
        print(traceback.format_exc())
        return jsonify({"status": "error", "message": str(e)}), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8000))
    app.run(host='0.0.0.0', port=port)
