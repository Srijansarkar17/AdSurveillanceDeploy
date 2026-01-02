"""
Status Manager - Tracks and manages ads fetching job status
"""
from datetime import datetime
import threading
import time
from typing import Dict, Any, Optional, List
from supabase import create_client, Client
import os
import sys

# Add parent directory to path to import config
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config import Config

class StatusManager:
    """Manages status of ads fetching jobs"""
    
    def __init__(self):
        self.supabase: Client = create_client(Config.SUPABASE_URL, Config.SUPABASE_KEY)
        self.active_jobs: Dict[str, Dict] = {}
        self.lock = threading.Lock()
    
    def update_job_status(self, job_id: str, status: str, **kwargs) -> bool:
        """
        Update job status in database
        
        Args:
            job_id: The job ID
            status: New status (pending, running, completed, failed)
            **kwargs: Additional fields to update
        
        Returns:
            True if successful, False otherwise
        """
        try:
            update_data = {
                'status': status,
                'updated_at': datetime.now().isoformat()
            }
            
            # Add any additional fields
            for key, value in kwargs.items():
                if value is not None:
                    update_data[key] = value
            
            # If job is completed or failed, set end_time
            if status in ['completed', 'failed'] and 'end_time' not in update_data:
                update_data['end_time'] = datetime.now().isoformat()
            
            response = self.supabase.table('ads_fetch_jobs')\
                .update(update_data)\
                .eq('job_id', job_id)\
                .execute()
            
            # Update in-memory cache
            with self.lock:
                if job_id in self.active_jobs:
                    self.active_jobs[job_id].update(update_data)
                else:
                    # Get full job data if not in cache
                    full_job = self.get_job_status(job_id)
                    if full_job:
                        self.active_jobs[job_id] = full_job
            
            return True
        except Exception as e:
            print(f"Error updating job status: {e}")
            return False
    
    def get_job_status(self, job_id: str) -> Optional[Dict[str, Any]]:
        """
        Get current status of a job
        
        Args:
            job_id: The job ID
        
        Returns:
            Job status dictionary or None if not found
        """
        # Check in-memory cache first
        with self.lock:
            if job_id in self.active_jobs:
                return self.active_jobs[job_id].copy()
        
        # Fall back to database
        try:
            response = self.supabase.table('ads_fetch_jobs')\
                .select('*')\
                .eq('job_id', job_id)\
                .execute()
            
            if response.data:
                job_data = response.data[0]
                
                # Calculate duration if not present
                if job_data.get('end_time') and job_data.get('start_time'):
                    if isinstance(job_data['start_time'], str):
                        start_dt = datetime.fromisoformat(job_data['start_time'].replace('Z', '+00:00'))
                    else:
                        start_dt = job_data['start_time']
                    
                    if isinstance(job_data['end_time'], str):
                        end_dt = datetime.fromisoformat(job_data['end_time'].replace('Z', '+00:00'))
                    else:
                        end_dt = job_data['end_time']
                    
                    job_data['duration_seconds'] = int((end_dt - start_dt).total_seconds())
                
                # Update cache
                with self.lock:
                    self.active_jobs[job_id] = job_data
                
                return job_data
            return None
        except Exception as e:
            print(f"Error getting job status: {e}")
            return None
    
    def register_job(self, job_id: str, user_id: str, platform: str = "all") -> bool:
        """
        Register a new job
        
        Args:
            job_id: The job ID
            user_id: User who initiated the job
            platform: Platform to fetch from
        
        Returns:
            True if successful, False otherwise
        """
        try:
            # Get competitor count for this user
            response = self.supabase.table('competitors')\
                .select('id', count='exact')\
                .eq('user_id', user_id)\
                .execute()
            
            competitor_count = response.count or 0
            
            job_data = {
                'job_id': job_id,
                'user_id': user_id,
                'status': 'pending',
                'platform': platform,
                'total_competitors': competitor_count,
                'ads_fetched': 0,
                'start_time': datetime.now().isoformat(),
                'created_at': datetime.now().isoformat(),
                'updated_at': datetime.now().isoformat()
            }
            
            response = self.supabase.table('ads_fetch_jobs')\
                .insert(job_data)\
                .execute()
            
            # Add to cache
            with self.lock:
                self.active_jobs[job_id] = job_data
            
            return True
        except Exception as e:
            print(f"Error registering job: {e}")
            return False
    
    def get_user_jobs(self, user_id: str, limit: int = 10) -> List[Dict[str, Any]]:
        """
        Get all jobs for a specific user
        
        Args:
            user_id: The user ID
            limit: Maximum number of jobs to return
        
        Returns:
            List of job dictionaries
        """
        try:
            response = self.supabase.table('ads_fetch_jobs')\
                .select('*')\
                .eq('user_id', user_id)\
                .order('created_at', desc=True)\
                .limit(limit)\
                .execute()
            
            jobs = response.data if response.data else []
            
            # Calculate durations for each job
            for job in jobs:
                if job.get('end_time') and job.get('start_time'):
                    if isinstance(job['start_time'], str):
                        start_dt = datetime.fromisoformat(job['start_time'].replace('Z', '+00:00'))
                    else:
                        start_dt = job['start_time']
                    
                    if isinstance(job['end_time'], str):
                        end_dt = datetime.fromisoformat(job['end_time'].replace('Z', '+00:00'))
                    else:
                        end_dt = job['end_time']
                    
                    job['duration_seconds'] = int((end_dt - start_dt).total_seconds())
            
            return jobs
        except Exception as e:
            print(f"Error getting user jobs: {e}")
            return []
    
    def cleanup_old_jobs(self, days_old: int = 7) -> int:
        """
        Clean up jobs older than specified days
        
        Args:
            days_old: Delete jobs older than this many days
        
        Returns:
            Number of jobs deleted
        """
        try:
            # Calculate cutoff date
            cutoff_date = datetime.now().isoformat()
            
            # Delete old jobs
            response = supabase.table('ads_fetch_jobs')\
                .delete()\
                .lt('created_at', cutoff_date)\
                .execute()
            
            deleted_count = len(response.data) if response.data else 0
            
            # Clean up cache
            with self.lock:
                cutoff_timestamp = time.time() - (days_old * 24 * 3600)
                jobs_to_remove = []
                
                for job_id, job_data in self.active_jobs.items():
                    created_at = job_data.get('created_at')
                    if isinstance(created_at, str):
                        created_dt = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
                        created_ts = created_dt.timestamp()
                    else:
                        created_ts = created_at.timestamp() if hasattr(created_at, 'timestamp') else cutoff_timestamp
                    
                    if created_ts < cutoff_timestamp:
                        jobs_to_remove.append(job_id)
                
                for job_id in jobs_to_remove:
                    del self.active_jobs[job_id]
            
            return deleted_count
        except Exception as e:
            print(f"Error cleaning up old jobs: {e}")
            return 0
    
    def get_job_statistics(self, user_id: str = None) -> Dict[str, Any]:
        """
        Get statistics about jobs
        
        Args:
            user_id: Optional user ID to filter by
        
        Returns:
            Dictionary with statistics
        """
        try:
            query = supabase.table('ads_fetch_jobs').select('*')
            
            if user_id:
                query = query.eq('user_id', user_id)
            
            response = query.execute()
            jobs = response.data if response.data else []
            
            stats = {
                'total_jobs': len(jobs),
                'completed': 0,
                'failed': 0,
                'running': 0,
                'pending': 0,
                'total_ads_fetched': 0,
                'total_duration_seconds': 0,
                'avg_duration_seconds': 0
            }
            
            total_duration = 0
            completed_with_duration = 0
            
            for job in jobs:
                status = job.get('status', 'unknown')
                if status in stats:
                    stats[status] += 1
                
                ads_fetched = job.get('ads_fetched', 0)
                stats['total_ads_fetched'] += ads_fetched
                
                if job.get('duration_seconds'):
                    total_duration += job['duration_seconds']
                    completed_with_duration += 1
            
            if completed_with_duration > 0:
                stats['total_duration_seconds'] = total_duration
                stats['avg_duration_seconds'] = total_duration / completed_with_duration
            
            return stats
        except Exception as e:
            print(f"Error getting job statistics: {e}")
            return {}
    
    def is_job_running(self, user_id: str = None, job_id: str = None) -> bool:
        """
        Check if a job is currently running
        
        Args:
            user_id: Optional user ID to check for running jobs
            job_id: Optional specific job ID to check
        
        Returns:
            True if a job is running, False otherwise
        """
        try:
            query = supabase.table('ads_fetch_jobs')\
                .select('id')\
                .eq('status', 'running')
            
            if user_id:
                query = query.eq('user_id', user_id)
            
            if job_id:
                query = query.eq('job_id', job_id)
            
            response = query.limit(1).execute()
            
            return len(response.data) > 0 if response.data else False
        except Exception as e:
            print(f"Error checking if job is running: {e}")
            return False
    
    def format_job_for_display(self, job: Dict[str, Any]) -> Dict[str, Any]:
        """
        Format a job for display in frontend
        
        Args:
            job: The job dictionary
        
        Returns:
            Formatted job dictionary
        """
        formatted = job.copy()
        
        # Add status icon
        status = job.get('status', 'unknown')
        status_icons = {
            'completed': '✅',
            'running': '🔄',
            'failed': '❌',
            'pending': '⏳'
        }
        formatted['status_icon'] = status_icons.get(status, '❓')
        
        # Format duration
        duration = job.get('duration_seconds')
        if duration:
            if duration < 60:
                formatted['duration_formatted'] = f"{duration}s"
            elif duration < 3600:
                minutes = duration // 60
                seconds = duration % 60
                formatted['duration_formatted'] = f"{minutes}m {seconds}s"
            else:
                hours = duration // 3600
                minutes = (duration % 3600) // 60
                formatted['duration_formatted'] = f"{hours}h {minutes}m"
        else:
            formatted['duration_formatted'] = 'N/A'
        
        # Calculate progress percentage
        if status == 'completed':
            formatted['progress'] = 100
        elif status == 'failed':
            formatted['progress'] = 0
        elif status == 'running':
            # Estimate progress based on time elapsed
            start_time = job.get('start_time')
            if start_time:
                if isinstance(start_time, str):
                    start_dt = datetime.fromisoformat(start_time.replace('Z', '+00:00'))
                else:
                    start_dt = start_time
                
                elapsed = (datetime.now(start_dt.tzinfo) - start_dt).total_seconds()
                estimated_total = job.get('total_competitors', 1) * 30
                estimated_total = min(estimated_total, 300)
                
                if estimated_total > 0:
                    progress = min(90, (elapsed / estimated_total) * 100)
                    formatted['progress'] = round(progress, 1)
                else:
                    formatted['progress'] = 50
            else:
                formatted['progress'] = 0
        else:
            formatted['progress'] = 0
        
        # Format timestamps
        for time_field in ['start_time', 'end_time', 'created_at', 'updated_at']:
            if job.get(time_field):
                if isinstance(job[time_field], str):
                    dt = datetime.fromisoformat(job[time_field].replace('Z', '+00:00'))
                    formatted[f'{time_field}_formatted'] = dt.strftime('%Y-%m-%d %H:%M:%S')
        
        return formatted

# Create a global instance for easy access
status_manager = StatusManager()

if __name__ == '__main__':
    # Test the status manager
    print("🧪 Testing Status Manager...")
    
    manager = StatusManager()
    
    # Test statistics
    stats = manager.get_job_statistics()
    print(f"\n📊 Statistics:")
    for key, value in stats.items():
        print(f"  {key}: {value}")
    
    # Test cleanup
    deleted = manager.cleanup_old_jobs(days_old=30)
    print(f"\n🗑️  Cleaned up {deleted} old jobs")
    
    print("\n✅ Status Manager is ready!")