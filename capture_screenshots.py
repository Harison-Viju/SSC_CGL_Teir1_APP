import os
import time
from playwright.sync_api import sync_playwright

os.makedirs("test_screenshots", exist_ok=True)

configs = [
    {"name": "desktop_1366x768_dark", "width": 1366, "height": 768, "dark": True},
    {"name": "desktop_1366x768_light", "width": 1366, "height": 768, "dark": False},
    {"name": "wide_1835x862_dark", "width": 1835, "height": 862, "dark": True},
    {"name": "wide_1835x862_light", "width": 1835, "height": 862, "dark": False},
    {"name": "mobile_390x844_dark", "width": 390, "height": 844, "dark": True},
    {"name": "mobile_390x844_light", "width": 390, "height": 844, "dark": False},
]

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    
    for cfg in configs:
        context = browser.new_context(
            viewport={"width": cfg["width"], "height": cfg["height"]},
            color_scheme="dark" if cfg["dark"] else "light"
        )
        page = context.new_page()
        
        # Navigate to the exam view
        page.goto("http://localhost:3000/#/exam/ssc-cgl-2026-10-01?mode=full")
        # Set theme in localStorage and html class
        theme_val = "dark" if cfg["dark"] else "light"
        page.evaluate(f"""() => {{
            localStorage.setItem('examquest_theme', '{theme_val}');
            if ('{theme_val}' === 'dark') {{
                document.documentElement.classList.add('dark');
            }} else {{
                document.documentElement.classList.remove('dark');
            }}
        }}""")
        
        page.wait_for_timeout(1500)
        
        # Take screenshot of default question
        out_path = f"test_screenshots/{cfg['name']}_q1.png"
        page.screenshot(path=out_path, full_page=False)
        print(f"Captured: {out_path}")
        
        # Also navigate to an image question (e.g. Q21)
        if cfg["name"] == "desktop_1366x768_dark":
            # Jump to Q21
            page.evaluate("() => { const btns = Array.from(document.querySelectorAll('button')); const b = btns.find(x => x.textContent.trim() === '21'); if (b) b.click(); }")
            page.wait_for_timeout(800)
            q21_path = f"test_screenshots/{cfg['name']}_q21.png"
            page.screenshot(path=q21_path, full_page=False)
            print(f"Captured: {q21_path}")
            
        context.close()
        
    browser.close()

print("All screenshots generated successfully.")
