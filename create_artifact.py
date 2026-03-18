import os

out_path = r"C:\Users\rohit\.gemini\antigravity\brain\4d48aeb6-cf19-4f22-ac83-2f68b1290f5e\artifacts\daytask_code.md"
base_dir = r"C:\Users\rohit\.gemini\antigravity\scratch\DayTask-Notifier"

files = [
    "index.html",
    "frontend/manifest.json",
    "frontend/sw.js",
    "backend/server.js",
    "backend/package.json"
]

# ensure artifacts dir exists
os.makedirs(os.path.dirname(out_path), exist_ok=True)

with open(out_path, "w", encoding="utf-8") as out:
    out.write("# DayTask-Notifier Source Code\n\n")
    for f in files:
        file_path = os.path.join(base_dir, f.replace('/', os.sep))
        if os.path.exists(file_path):
            out.write(f"## {f}\n")
            ext = f.split('.')[-1]
            if ext == 'js': ext = 'javascript'
            out.write(f"```{ext}\n")
            with open(file_path, "r", encoding="utf-8") as inf:
                out.write(inf.read())
            out.write("\n```\n\n")
