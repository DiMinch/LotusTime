import json
import requests

def main():
    with open('payload.json', 'r', encoding='utf-8') as f:
        payload = json.load(f)

    print("Sending request to http://localhost:8000/solve...")
    try:
        r = requests.post('http://localhost:8000/solve', json=payload, timeout=60.0)
        print("Status Code:", r.status_code)
        print("Response JSON:")
        print(json.dumps(r.json(), indent=2))
    except Exception as e:
        print("Error:", e)

if __name__ == '__main__':
    main()
