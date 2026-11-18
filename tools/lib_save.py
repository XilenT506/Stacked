# Save a finished Higgsfield result into the asset library and log it.  usage: python3 tools/lib_save.py key job_id url [key job_id url ...]
import json, subprocess, sys, os
args = sys.argv[1:]; log = 'assets/library/jobs.json'
j = json.load(open(log))
for k, job, url in zip(args[0::3], args[1::3], args[2::3]):
    ext = os.path.splitext(url)[1] or '.png'
    out = f'assets/library/{k}{ext}'; os.makedirs(os.path.dirname(out), exist_ok=True)
    subprocess.run(['curl', '-s', '-o', out, url], check=True)
    j = [e for e in j if e['key'] != k] + [{'key': k, 'job': job, 'url': url, 'file': out}]
    print('saved', out, os.path.getsize(out))
json.dump(j, open(log, 'w'), indent=1)
