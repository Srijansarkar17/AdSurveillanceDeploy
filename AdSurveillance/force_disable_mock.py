import os
import sys

# Path to ads_refresh.py
ads_refresh_path = 'api/ads_refresh.py'

print("�� FORCE DISABLING MOCK MODE...")

with open(ads_refresh_path, 'r') as f:
    content = f.read()

# Remove ALL mock mode references
replacements = [
    ('Running in mock mode', 'REAL FETCHING REQUIRED - NO MOCK MODE'),
    ('mock_mode = True', 'mock_mode = False'),
    ('"mock": True', '"mock": False'),
    ('run_mock_fetch', '# run_mock_fetch DISABLED'),
    ('def run_mock_fetch', '# def run_mock_fetch DISABLED'),
]

for old, new in replacements:
    if old in content:
        content = content.replace(old, new)
        print(f"✅ Replaced: {old} → {new}")

# Also ensure the fetcher check is strict
strict_check = '''
# ========== STRICT ADS FETCHER CHECK (NO MOCK) ==========
if not FETCHER_AVAILABLE:
    print("🚫 CRITICAL ERROR: AdsFetcher not available")
    print("💡 System will FAIL instead of using mock mode")
    print("   Create ads_fetcher.py in ad_fetch_service/")
    # Don't set any fallback - let it fail
'''

# Add strict check if not present
if 'STRICT ADS FETCHER CHECK' not in content:
    # Find where to insert
    lines = content.split('\n')
    for i, line in enumerate(lines):
        if 'FETCHER_AVAILABLE = False' in line:
            lines.insert(i + 2, strict_check)
            break
    content = '\n'.join(lines)

with open(ads_refresh_path, 'w') as f:
    f.write(content)

print("\n✅ Mock mode FORCE DISABLED")
print("🎯 System will now FAIL if ads_fetcher is not available")
