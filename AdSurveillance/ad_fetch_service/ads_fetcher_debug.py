"""
DEBUG Ads Fetcher - Extra logging
"""
import os
import subprocess
import time
from datetime import datetime

class AdsFetcherDebug:
    def __init__(self):
        self.ads_fetch_dir = os.path.join(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
            'src'
        )
        self.timeout = 300
    
    def run_for_user(self, user_id, platform="all"):
        print(f"🔍 DEBUG: Starting for user {user_id}")
        print(f"📁 Directory: {self.ads_fetch_dir}")
        print(f"📁 Exists: {os.path.exists(self.ads_fetch_dir)}")
        
        if not os.path.exists(self.ads_fetch_dir):
            return False, "Directory not found", 0
        
        # Check if we can run npm
        try:
            original_dir = os.getcwd()
            os.chdir(self.ads_fetch_dir)
            print(f"📁 Changed to: {os.getcwd()}")
            
            # Check package.json
            if not os.path.exists('package.json'):
                return False, "No package.json", 0
            
            # Set environment
            env = os.environ.copy()
            env['USER_ID'] = user_id
            env['PLATFORM'] = platform
            
            print(f"🚀 DEBUG: Running npm start with USER_ID={user_id}")
            print(f"⚙️  Command: npm start")
            
            # Run with more visibility
            process = subprocess.Popen(
                ['npm', 'start'],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                env=env
            )
            
            # Read output in real-time
            output_lines = []
            for line in iter(process.stdout.readline, ''):
                print(f"📝 NODE: {line.strip()}")
                output_lines.append(line)
            
            process.wait()
            stdout = ''.join(output_lines)
            stderr = process.stderr.read() if process.stderr else ""
            
            print(f"📊 DEBUG: Process exited with code {process.returncode}")
            
            if stderr:
                print(f"❌ ERRORS: {stderr}")
            
            return process.returncode == 0, stdout + stderr, 0
            
        except Exception as e:
            print(f"💥 DEBUG Exception: {e}")
            return False, str(e), 0
        finally:
            os.chdir(original_dir)

# Test it
if __name__ == '__main__':
    print("🧪 DEBUG TEST")
    fetcher = AdsFetcherDebug()
    success, logs, count = fetcher.run_for_user("test-user")
    print(f"✅ Success: {success}")
    print(f"📝 Logs length: {len(logs)}")
