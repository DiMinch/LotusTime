import json

def main():
    with open('payload.json', 'r', encoding='utf-8') as f:
        data = json.load(f)

    classes = data.get('classes', [])
    persons = data.get('persons', [])
    pins = data.get('pins', [])
    availabilities = data.get('availabilities', [])

    selected_codes = ['ART 1', 'Flyers', 'L01', 'L02']
    selected_classes = [c for c in classes if c['code'] in selected_codes]

    person_map = {p['id']: p for p in persons}
    
    print("=== CLASSES ===")
    for c in selected_classes:
        print(f"Class: {c['code']} ({c['id']})")
        print(f"  Sessions per week: {c.get('sessions_per_week')}")
        perms = c.get('permissions', [])
        allowed_teachers = []
        for perm in perms:
            p = person_map.get(perm['person_id'])
            if p:
                caps = p.get('capabilities', [])
                is_t = 'lead_teacher' in caps or 'foreign_teacher' in caps
                allowed_teachers.append(f"{p['short_name']} (Teacher: {is_t}, Caps: {caps})")
        print(f"  Allowed Teachers: {allowed_teachers}")

    print("\n=== PINS ===")
    for pin in pins:
        c = next((x for x in classes if x['id'] == pin['class_id']), None)
        c_code = c['code'] if c else 'Unknown'
        print(f"Pin: Class {c_code}, Room {pin['room_id']}, Slot {pin['time_slot_id']}")

if __name__ == '__main__':
    main()
