import json

def main():
    with open('payload.json', 'r', encoding='utf-8') as f:
        data = json.load(f)

    time_slots = data.get('time_slots', [])
    print(f"Total time slots: {len(time_slots)}")
    
    # Group by day and print start times
    days = {}
    for ts in time_slots:
        d = ts['day_of_week']
        days.setdefault(d, []).append(ts['start_time'])
        
    for d in sorted(days.keys()):
        print(f"Day {d}: {len(days[d])} slots: {sorted(list(set(days[d])))}")

if __name__ == '__main__':
    main()
