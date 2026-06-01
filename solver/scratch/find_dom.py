import os
import glob
import re

app_data = r"C:\Users\Admin\.gemini\antigravity\brain\2af84dd7-e16e-4309-9f4f-027efdeaae33"
files = glob.glob(os.path.join(app_data, "**", "*.txt"), recursive=True)
dom_files = [f for f in files if "dom" in f.lower() or "click" in f.lower()]
dom_files.sort(key=os.path.getmtime, reverse=True)

for f in dom_files[:5]:
    try:
        with open(f, 'r', encoding='utf-8') as file:
            content = file.read()
            # find all 'a' tags or elements with 'Xuất'
            if "Xuất Excel" in content:
                print(f"\n--- MATCH IN {os.path.basename(f)} ---")
                # find the line with Xuất Excel
                for line in content.split('\n'):
                    if "Xuất Excel" in line:
                        print(line)
    except Exception as e:
        print(e)
