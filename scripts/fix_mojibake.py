SNAPSHOT = r'C:/Users/Clover/Desktop/transition-companion/.claude/worktrees/affectionate-haslett-88c1bb/public/kb-snapshot/index.json'

EM_MOJI = "\\u00e2\\u20ac\\u201d"
EN_MOJI = "\\u00e2\\u20ac\\u201c"
EM_OK = "\\u2014"
EN_OK = "\\u2013"

with open(SNAPSHOT, 'r', encoding='utf-8') as f:
    text = f.read()

em_n = text.count(EM_MOJI)
en_n = text.count(EN_MOJI)

text = text.replace(EM_MOJI, EM_OK)
text = text.replace(EN_MOJI, EN_OK)

with open(SNAPSHOT, 'w', encoding='utf-8', newline='') as f:
    f.write(text)

print("em-dashes fixed:", em_n)
print("en-dashes fixed:", en_n)

with open(SNAPSHOT, 'r', encoding='utf-8') as f:
    after = f.read()
print("remaining mojibake:", after.count("\\u00e2\\u20ac"))
print("em-dash escapes now:", after.count(EM_OK))
print("en-dash escapes now:", after.count(EN_OK))
