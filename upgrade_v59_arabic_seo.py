import json, re, xml.etree.ElementTree as ET

# 1) Create client/public/sitemap.xml
sitemap_xml = '''<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://shahezo-store.onrender.com/</loc>
    <lastmod>2026-11-20</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://shahezo-store.onrender.com/products</loc>
    <lastmod>2026-11-20</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>https://shahezo-store.onrender.com/categories</loc>
    <lastmod>2026-11-20</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://shahezo-store.onrender.com/offers</loc>
    <lastmod>2026-11-20</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>
</urlset>
'''
with open("client/public/sitemap.xml", "w", encoding="utf-8") as f:
    f.write(sitemap_xml)
ET.fromstring(sitemap_xml)

# 2) Update client/index.html
idx_path = "client/index.html"
with open(idx_path, "r", encoding="utf-8") as f:
    html = f.read()

old_title = "<title>شهيزو | بوفية ومطعم شهيزو – أشهى فلافل ساخنة وشاورما وعصائر طبيعية</title>"
new_title = "<title>شهيزو (شيزو) | شهي ولذيذ – بوفية ومطعم فلافل ساخنة وشاورما وعصائر طبيعية</title>"
assert old_title in html, "old_title not found"
html = html.replace(old_title, new_title, 1)

old_desc = '<meta name="description" content="موقع شهيزو الرسمي (SHAHEZO) – اطلب أونلاين أشهى فلافل ساخنة ومقرمشة، شاورما عربي وصاج، وعصائر طبيعية طازجة من بوفية شهيزو مع توصيل سريع للطلبات: 779542219 - 772206455." />'
new_desc = '<meta name="description" content="موقع شهيزو الرسمي (شيزو – SHAHEZO) شهي ولذيذ في صنعاء – اطلب أونلاين أشهى فلافل ساخنة ومقرمشة، شاورما عربي وصاج، وعصائر طبيعية طازجة من بوفية ومطعم شهيزو مع توصيل سريع للطلبات: 779542219 - 772206455." />'
assert old_desc in html, "old_desc not found"
html = html.replace(old_desc, new_desc, 1)

old_kw = '<meta name="keywords" content="شهيزو, بوفية شهيزو, مطعم شهيزو, موقع شهيزو, تطبيق شهيزو, فلافل, فلافل شهيزو, أفضل فلافل, فلافل ساخنة, ساندوتش فلافل, صحن فلافل, فلافل محشية, شاورما, شاورما شهيزو, شاورما عربي, عصائر طبيعية, بوفية فلافل وشاورما, توصيل فلافل, طلب فلافل أونلاين, Shahezo, Shizo, shizo.ye" />'
new_kw = '<meta name="keywords" content="شهيزو, شيزو, شهي ولذيذ, شهي ولذيذ فلافل, فلافل شهي ولذيذ, بوفية شهيزو, مطعم شهيزو, بوفية شيزو, موقع شهيزو, تطبيق شهيزو, فلافل شهيزو, فلافل صنعاء, شاورما شهيزو, عصائر طبيعية, توصيل فلافل صنعاء, طلب فلافل أونلاين, SHAHEZO, Shahezo, Shizo, shizo.ye" />'
assert old_kw in html, "old_kw not found"
html = html.replace(old_kw, new_kw, 1)

old_alt = '"alternateName": ["بوفية شهيزو", "مطعم شهيزو", "فلافل شهيزو", "Shahezo", "shizo.ye"],'
new_alt = '''"alternateName": ["شهيزو", "شيزو", "شهي ولذيذ", "شهي ولذيذ فلافل", "بوفية شهيزو", "مطعم شهيزو", "فلافل شهيزو", "بوفية شيزو", "SHAHEZO", "Shizo", "shizo.ye"],
          "address": {
            "@type": "PostalAddress",
            "addressLocality": "صنعاء",
            "addressCountry": "YE"
          },
          "sameAs": [
            "https://facebook.com/shizo.ye",
            "https://instagram.com/shizo.ye",
            "https://tiktok.com/@shizo.ye"
          ],'''
assert old_alt in html, "old_alt not found"
html = html.replace(old_alt, new_alt, 1)

old_ws_alt = '"alternateName": ["شهيزو", "بوفية شهيزو", "فلافل شهيزو", "shahezo-store.onrender.com"],'
new_ws_alt = '"alternateName": ["شهيزو", "شيزو", "شهي ولذيذ", "بوفية شهيزو", "فلافل شهيزو", "shahezo-store.onrender.com"],'
assert old_ws_alt in html, "old_ws_alt not found"
html = html.replace(old_ws_alt, new_ws_alt, 1)

m = re.search(r'<script type="application/ld\+json">(.*?)</script>', html, re.S)
assert m and json.loads(m.group(1)), "Invalid JSON-LD"

with open(idx_path, "w", encoding="utf-8") as f:
    f.write(html)

# 3) Make server/_core/vite.ts title replace regex-safe for /admin
vite_path = "server/_core/vite.ts"
with open(vite_path, "r", encoding="utf-8") as f:
    vite_src = f.read()

old_vtitle = """      .replace('<title>شهيزو | بوفية ومطعم شهيزو – أشهى فلافل ساخنة وشاورما وعصائر طبيعية</title>', '<title>إدارة شهيزو – لوحة التحكم المستقلة</title>');"""
new_vtitle = """      .replace(/<title>.*?<\\/title>/, '<title>إدارة شهيزو – لوحة التحكم المستقلة</title>');"""
assert old_vtitle in vite_src, "old_vtitle not found"
vite_src = vite_src.replace(old_vtitle, new_vtitle, 1)
with open(vite_path, "w", encoding="utf-8") as f:
    f.write(vite_src)

# 4) Add compact Arabic SEO line in footer of client/src/pages/Home.tsx
home_path = "client/src/pages/Home.tsx"
with open(home_path, "r", encoding="utf-8") as f:
    home_src = f.read()

old_footer = '''{shouldShowFooterDescription(data.settings.storeDescription) && <span>{data.settings.storeDescription}</span>}<small>© {new Date().getFullYear()} {data.settings.storeName || "شهيزو – SHAHEZO"}</small></footer>'''
new_footer = '''{shouldShowFooterDescription(data.settings.storeDescription) && <span>{data.settings.storeDescription}</span>}<p style={{ margin: "4px 0 0", fontSize: "11px", color: "#8c766e", lineHeight: 1.6, maxWidth: "560px" }}>شهيزو (شيزو) – شهي ولذيذ: بوفية ومطعم فلافل ساخنة ومقرمشة، شاورما، وعصائر طبيعية طازجة مع توصيل سريع في صنعاء.</p><small>© {new Date().getFullYear()} {data.settings.storeName || "شهيزو – SHAHEZO"}</small></footer>'''
assert old_footer in home_src, "old_footer not found"
home_src = home_src.replace(old_footer, new_footer, 1)
with open(home_path, "w", encoding="utf-8") as f:
    f.write(home_src)

print("✅ تم إضافة sitemap.xml وتقوية تصدر الكلمات العربية بنجاح")
