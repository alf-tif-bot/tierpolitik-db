import re, pathlib
p=pathlib.Path(r"C:\Users\yokim\.openclaw\workspace\tmp\tif-styleguide.pdf")
b=p.read_bytes()
s=b.decode('latin1','ignore')
hexes=sorted(set(re.findall(r'#[0-9A-Fa-f]{6}',s)))
print('hex count',len(hexes))
print(hexes[:200])
