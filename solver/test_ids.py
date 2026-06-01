import json

def main():
    with open('payload.json', 'r', encoding='utf-8') as f:
        data = json.load(f)

    time_slots = data.get('time_slots', [])
    availabilities = data.get('availabilities', [])
    persons = data.get('persons', [])

    ts_ids = {ts['id'] for ts in time_slots}
    avail_ts_ids = {a['time_slot_id'] for a in availabilities}

    print(f"Number of time slots in payload: {len(ts_ids)}")
    print(f"Number of unique time slots in availabilities: {len(avail_ts_ids)}")
    
    missing_in_ts = avail_ts_ids - ts_ids
    print(f"Avail time slots missing from time_slots: {len(missing_in_ts)}")

    # Check how many free slots each teacher has that actually match active time slots
    person_map = {p['id']: p['short_name'] for p in persons}
    for pid, name in person_map.items():
        matched_avails = [a for a in availabilities if a['person_id'] == pid and a['time_slot_id'] in ts_ids]
        print(f"Teacher {name} has {len(matched_avails)} matching availabilities out of {len([a for a in availabilities if a['person_id'] == pid])} total.")

if __name__ == '__main__':
    main()
