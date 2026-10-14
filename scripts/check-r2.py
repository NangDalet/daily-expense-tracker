"""Read-only R2 connectivity check. Reads ignored backend/.env.r2; never prints credentials."""
import datetime
import argparse
import hashlib
import hmac
from pathlib import Path
import urllib.error
import urllib.request
import urllib.parse
import xml.etree.ElementTree as ET

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--key", help="Read one known object without printing its contents")
parser.add_argument("--expect-missing", action="store_true", help="Verify a removed object returns NoSuchKey")
args = parser.parse_args()
if args.expect_missing and not args.key:
    parser.error("--expect-missing requires --key")

config = dict(line.split("=", 1) for line in
              (Path(__file__).resolve().parent.parent / "backend" / ".env.r2").read_text().splitlines()
              if line.strip() and not line.lstrip().startswith("#") and "=" in line)
host = config["R2_ACCOUNT_ID"] + ".r2.cloudflarestorage.com"
now = datetime.datetime.now(datetime.timezone.utc)
date, timestamp = now.strftime("%Y%m%d"), now.strftime("%Y%m%dT%H%M%SZ")
digest = hashlib.sha256(b"").hexdigest()
bucket = config.get("R2_BUCKET", "").strip()
path = "/" + urllib.parse.quote(bucket, safe="") if bucket else "/"
if args.key:
    if not bucket:
        parser.error("Set R2_BUCKET before checking an object")
    path += "/" + urllib.parse.quote(args.key, safe="/")
query = "list-type=2&max-keys=1" if bucket and not args.key else ""
canonical = "GET\n" + path + "\n" + query + "\nhost:" + host + "\nx-amz-content-sha256:" + digest + "\nx-amz-date:" + timestamp + "\n\nhost;x-amz-content-sha256;x-amz-date\n" + digest
scope = date + "/auto/s3/aws4_request"
to_sign = "AWS4-HMAC-SHA256\n" + timestamp + "\n" + scope + "\n" + hashlib.sha256(canonical.encode()).hexdigest()
key = ("AWS4" + config["R2_SECRET_ACCESS_KEY"]).encode()
for part in [date, "auto", "s3", "aws4_request"]:
    key = hmac.new(key, part.encode(), hashlib.sha256).digest()
signature = hmac.new(key, to_sign.encode(), hashlib.sha256).hexdigest()
request = urllib.request.Request("https://" + host + path + ("?" + query if query else ""), headers={
    "x-amz-date": timestamp, "x-amz-content-sha256": digest,
    "Authorization": "AWS4-HMAC-SHA256 Credential=" + config["R2_ACCESS_KEY_ID"] + "/" + scope
                     + ", SignedHeaders=host;x-amz-content-sha256;x-amz-date, Signature=" + signature,
})
try:
    with urllib.request.urlopen(request, timeout=20) as response:
        body = response.read()
    if args.key:
        if args.expect_missing:
            print("R2 check failed: object still exists")
            raise SystemExit(1)
        print("R2 object read OK. Bytes:", len(body))
    elif bucket:
        print("R2 connection OK. Bucket reachable:", bucket)
    else:
        root = ET.fromstring(body)
        buckets = [element.text for element in root.findall(".//{*}Bucket/{*}Name")]
        print("R2 connection OK. Accessible buckets:", ", ".join(buckets) or "(none)")
except urllib.error.HTTPError as error:
    root = ET.fromstring(error.read())
    code = root.findtext("{*}Code", default="Unknown")
    if args.expect_missing and error.code == 404 and code == "NoSuchKey":
        print("R2 cleanup verified: object no longer exists")
        raise SystemExit(0)
    print("R2 check failed:", error.code, code)
    raise SystemExit(1)
