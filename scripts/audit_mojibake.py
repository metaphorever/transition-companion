import re
from collections import Counter

SNAPSHOT = r'C:/Users/Clover/Desktop/transition-companion/.claude/worktrees/affectionate-haslett-88c1bb/public/kb-snapshot/index.json'

with open(SNAPSHOT, 'r', encoding='utf-8') as f:
    text = f.read()

# A mojibake-em-dash JSON escape is â€”.
# The general pattern is the cp1252-interpreted bytes of UTF-8 punctuation.
# Most UTF-8 punctuation starts E2 80 ..., which cp1252-decodes to U+00E2 U+20AC U+xxxx.
pat = r"\\u00e2\\u20ac\\u[0-9a-fA-F]{4}"
hits = re.findall(pat, text)
print("mojibake triplets:")
for k, v in Counter(hits).items():
    print("  " + k + ": " + str(v))
print("total:", len(hits))

# Also: any isolated \u00xx escapes for high Latin-1?
iso = re.findall(r"\\u00[8-9a-fA-F][0-9a-fA-F]", text)
print("isolated hi-byte escapes:", Counter(iso))
