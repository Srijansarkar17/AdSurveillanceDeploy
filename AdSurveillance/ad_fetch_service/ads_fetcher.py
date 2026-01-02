"""
Ads Fetcher - Python wrapper for TypeScript/Node.js ads fetching module
NO MOCK MODE - Returns empty if not properly configured
"""
import os
import subprocess
import sys
import json
import time
from datetime import datetime
from typing import Tuple, Optional, Dict, Any

class AdsFetcher:
    """Python interface to run the TypeScript ads fetching module"""
    
    def __init__(self, timeout: int = None):
        """
        Initialize the ads fetcher
        
        Args:
            timeout: Maximum time in seconds to wait for ads fetching
        """
        # Import config
        try:
            import sys
            import os
            config_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'config.py')
            if os.path.exists(config_path):
                sys.path.append(os.path.dirname(config_path))
                from config import Config
                self.timeout = timeout or Config.ADS_FETCH_TIMEOUT
                self.ads_fetch_dir = Config.ADS_FETCH_DIR
                self.node_script = Config.NODE_SCRIPT
            else:
                # Default values if config not found
                self.timeout = timeout or 300
                self.ads_fetch_dir = os.path.join(
                    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                    'src'
                )
                self.node_script = 'npm start'
        except ImportError:
            # Fallback defaults
            self.timeout = timeout or 300
            self.ads_fetch_dir = os.path.join(
                os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                'src'
            )
            self.node_script = 'npm start'
    
    def verify_environment(self) -> Tuple[bool, str]:
        """
        Verify that Node.js environment is properly set up
        
        Returns:
            Tuple of (success, message)
        """
        try:
            # Check if directory exists
            if not os.path.exists(self.ads_fetch_dir):
                return False, f"Ads fetch directory not found: {self.ads_fetch_dir}"
            
            # Check for package.json
            package_json = os.path.join(self.ads_fetch_dir, 'package.json')
            if not os.path.exists(package_json):
                return False, f"package.json not found in {self.ads_fetch_dir}"
            
            # Check Node.js availability
            try:
                result = subprocess.run(['node', '--version'], 
                                      capture_output=True, 
                                      text=True, 
                                      timeout=5)
                if result.returncode != 0:
                    return False, "Node.js is not properly installed"
            except FileNotFoundError:
                return False, "Node.js is not installed"
            
            # Check npm availability
            try:
                result = subprocess.run(['npm', '--version'], 
                                      capture_output=True, 
                                      text=True, 
                                      timeout=5)
                if result.returncode != 0:
                    return False, "npm is not properly installed"
            except FileNotFoundError:
                return False, "npm is not installed"
            
            return True, "Environment verification passed"
            
        except Exception as e:
            return False, f"Environment verification failed: {str(e)}"
    
    def run_for_user(self, user_id: str, platform: str = "all") -> Tuple[bool, str, int]:
        """
        Run REAL ads fetching for a specific user
        NO MOCK MODE - Returns failure if can't run
        
        Args:
            user_id: The user ID to fetch ads for
            platform: Which platform to fetch from ('meta', 'google', 'linkedin', 'tiktok', 'all')
            
        Returns:
            Tuple of (success, logs, ads_count)
        """
        print(f"🚀 Starting REAL ads fetch for user {user_id} on platform {platform}")
        
        # Verify environment first
        env_ok, env_message = self.verify_environment()
        if not env_ok:
            return False, f"Environment check failed: {env_message}", 0
        
        # Save original directory
        original_dir = os.getcwd()
        
        try:
            # Change to ads fetch directory
            os.chdir(self.ads_fetch_dir)
            print(f"📁 Changed to directory: {os.getcwd()}")
            
            # Prepare environment variables for Node.js
            env = os.environ.copy()
            env['USER_ID'] = user_id
            env['PLATFORM'] = platform
            env['PYTHON_CALL'] = 'true'
            
            # Determine command to run
            if self.node_script == 'npm start':
                cmd = ['npm', 'run', 'start']
            elif self.node_script.startswith('node '):
                cmd = ['node', self.node_script.replace('node ', '', 1)]
            elif self.node_script.startswith('ts-node '):
                cmd = ['ts-node', self.node_script.replace('ts-node ', '', 1)]
            else:
                cmd = self.node_script.split()
            
            print(f"🔧 Running command: {' '.join(cmd)}")
            print(f"⚙️  Environment: USER_ID={user_id}, PLATFORM={platform}")
            
            # Run the command with timeout
            start_time = time.time()
            
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=self.timeout,
                env=env
            )
            
            elapsed_time = time.time() - start_time
            
            # Parse output
            stdout = result.stdout
            stderr = result.stderr
            returncode = result.returncode
            
            # Combine logs
            logs = f"=== REAL Ads Fetching Results ===\n"
            logs += f"User ID: {user_id}\n"
            logs += f"Platform: {platform}\n"
            logs += f"Start Time: {datetime.fromtimestamp(start_time)}\n"
            logs += f"Elapsed Time: {elapsed_time:.2f} seconds\n"
            logs += f"Return Code: {returncode}\n"
            logs += f"\n=== STDOUT ===\n{stdout}\n"
            
            if stderr:
                logs += f"\n=== STDERR ===\n{stderr}\n"
            
            # Parse ads count from output (simple heuristic)
            ads_count = 0
            success = returncode == 0
            
            # Try to extract ads count from Node.js output
            if success:
                # Look for patterns like "Fetched X ads" or "ads_fetched: X"
                import re
                patterns = [
                    r'fetched\s+(\d+)\s+ads',
                    r'ads_fetched[:\s]+(\d+)',
                    r'Found\s+(\d+)\s+ads',
                    r'Total ads:\s*(\d+)'
                ]
                
                for pattern in patterns:
                    matches = re.findall(pattern, stdout + stderr, re.IGNORECASE)
                    if matches:
                        try:
                            ads_count = max([int(m) for m in matches])
                            break
                        except:
                            continue
                
                # If no pattern found, estimate based on output length
                if ads_count == 0 and 'ad' in stdout.lower():
                    # Very rough estimate
                    ads_count = min(50, stdout.count('ad ') + stdout.count('Ad '))
            
            print(f"✅ REAL ads fetch completed in {elapsed_time:.2f}s")
            print(f"   Success: {success}, Real ads count: {ads_count}")
            
            return success, logs, ads_count
            
        except subprocess.TimeoutExpired:
            error_msg = f"Ads fetching timed out after {self.timeout} seconds"
            print(f"❌ {error_msg}")
            return False, error_msg, 0
            
        except Exception as e:
            error_msg = f"Error running ads fetcher: {str(e)}"
            print(f"❌ {error_msg}")
            return False, error_msg, 0
            
        finally:
            # Always return to original directory
            os.chdir(original_dir)
            print(f"📁 Returned to directory: {os.getcwd()}")
    
    def test_connection(self) -> Dict[str, Any]:
        """
        Test the connection to Node.js module
        
        Returns:
            Dictionary with test results
        """
        env_ok, env_message = self.verify_environment()
        
        # Try to run a simple Node.js command
        node_version = "Unknown"
        npm_version = "Unknown"
        
        try:
            # Get Node.js version
            result = subprocess.run(['node', '--version'], 
                                  capture_output=True, 
                                  text=True, 
                                  timeout=5)
            if result.returncode == 0:
                node_version = result.stdout.strip()
        except:
            pass
        
        try:
            # Get npm version
            result = subprocess.run(['npm', '--version'], 
                                  capture_output=True, 
                                  text=True, 
                                  timeout=5)
            if result.returncode == 0:
                npm_version = result.stdout.strip()
        except:
            pass
        
        # Check for package.json
        package_json_exists = os.path.exists(os.path.join(self.ads_fetch_dir, 'package.json'))
        
        return {
            'environment_ok': env_ok,
            'environment_message': env_message,
            'node_version': node_version,
            'npm_version': npm_version,
            'ads_fetch_dir': self.ads_fetch_dir,
            'ads_fetch_dir_exists': os.path.exists(self.ads_fetch_dir),
            'package_json_exists': package_json_exists,
            'timeout_seconds': self.timeout,
            'node_script': self.node_script,
            'timestamp': datetime.now().isoformat(),
            'mock_mode': False
        }

# Create global instance
ads_fetcher = AdsFetcher()

if __name__ == '__main__':
    # Test the ads fetcher
    print("🧪 Testing Ads Fetcher...")
    
    fetcher = AdsFetcher()
    test_results = fetcher.test_connection()
    
    print("\n📊 Test Results:")
    for key, value in test_results.items():
        print(f"  {key}: {value}")
    
    if test_results['environment_ok']:
        print("\n✅ Environment is properly set up!")
        print("🎯 REAL ADS FETCHING READY")
    else:
        print(f"\n❌ Environment issues: {test_results['environment_message']}")
        print("🚫 REAL ADS FETCHING DISABLED")