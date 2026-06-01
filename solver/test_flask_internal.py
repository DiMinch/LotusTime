import json
from app import app

def main():
    with open('payload.json', 'r', encoding='utf-8') as f:
        payload = json.load(f)

    print("Running Flask test client internally...")
    client = app.test_client()
    r = client.post('/solve', json=payload)
    print("Status Code:", r.status_code)
    print("Response JSON:")
    print(json.dumps(r.get_json(), indent=2))

if __name__ == '__main__':
    main()
