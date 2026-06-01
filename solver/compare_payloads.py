import json

def diff_lists(list1, list2, name):
    if len(list1) != len(list2):
        print(f"Difference in {name} length: {len(list1)} vs {len(list2)}")
        return False
    
    # Sort by ID or content to compare
    try:
        s1 = sorted(list1, key=lambda x: x.get('id', str(x)))
        s2 = sorted(list2, key=lambda x: x.get('id', str(x)))
    except Exception:
        s1 = list1
        s2 = list2
        
    for i, (item1, item2) in enumerate(zip(s1, s2)):
        if item1 != item2:
            print(f"Difference in {name} at index {i}:")
            print("Payload 1:", json.dumps(item1, indent=2))
            print("Payload 2:", json.dumps(item2, indent=2))
            return False
    return True

def main():
    with open('payload.json', 'r', encoding='utf-8') as f:
        p1 = json.load(f)
    
    try:
        with open('payload_from_backend.json', 'r', encoding='utf-8') as f:
            p2 = json.load(f)
    except FileNotFoundError:
        print("Error: payload_from_backend.json not found!")
        return

    print("Comparing payloads...")
    keys = set(p1.keys()).union(p2.keys())
    for k in keys:
        if k not in p1 or k not in p2:
            print(f"Key {k} only in one of the payloads")
            continue
        
        v1 = p1[k]
        v2 = p2[k]
        if isinstance(v1, list) and isinstance(v2, list):
            res = diff_lists(v1, v2, k)
            if res:
                print(f"Key '{k}' is identical")
        else:
            if v1 != v2:
                print(f"Difference in key '{k}': {v1} vs {v2}")
            else:
                print(f"Key '{k}' is identical")

if __name__ == '__main__':
    main()
