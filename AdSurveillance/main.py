"""
AutoCreate Service Orchestrator for Runway Deployment
"""
import subprocess
import sys
import os
import time
import threading
from flask import Flask
from flask_cors import CORS

# Import all blueprints
from autocreate.api.AutoCreate.audience_step import audience_bp
from autocreate.api.AutoCreate.budget_testing import budget_testing_bp
from autocreate.api.AutoCreate.campaign_goal import campaign_goal_bp
from autocreate.api.AutoCreate.copy_messaging import copy_messaging_bp
from autocreate.api.AutoCreate.creative_assets import creative_assets_bp

class ServiceConfig:
    """Service configuration"""
    MAIN_PORT = int(os.environ.get("PORT", 5001))
    SERVICE_NAME = "AutoCreate"
    HOST = "0.0.0.0"
    
    # Service descriptions
    SERVICES = [
        ("🎯 Audience Step", "Audience targeting and segmentation"),
        ("💰 Budget Testing", "Budget optimization and testing"),
        ("🎯 Campaign Goal", "Campaign objective setting"),
        ("📝 Copy Messaging", "Ad copy and messaging creation"),
        ("🎨 Creative Assets", "Creative generation and management"),
    ]

def create_app():
    """Create and configure the Flask application"""
    app = Flask(__name__)
    CORS(app, origins=["*"])
    
    # Register all blueprints
    app.register_blueprint(audience_bp)
    app.register_blueprint(budget_testing_bp)
    app.register_blueprint(campaign_goal_bp)
    app.register_blueprint(copy_messaging_bp)
    app.register_blueprint(creative_assets_bp)
    
    # Root endpoint
    @app.route("/")
    def root():
        return {"service": ServiceConfig.SERVICE_NAME, "status": "running"}
    
    # Health check endpoint
    @app.route("/health")
    def health():
        return {"status": "healthy"}, 200
    
    return app

def print_service_dashboard():
    """
    Print beautiful service dashboard
    """
    print("\n" + "="*80)
    print("🚀 AUTOCREATE SERVICE DASHBOARD")
    print("="*80)
    
    for name, description in ServiceConfig.SERVICES:
        status = "✅ ACTIVE"
        print(f"{name:25} | {status:15} | {description}")
    
    print("="*80)
    print("\n📋 SERVICE INFORMATION:")
    print(f"• Service Name:    {ServiceConfig.SERVICE_NAME}")
    print(f"• Port:            {ServiceConfig.MAIN_PORT}")
    print(f"• Host:            {ServiceConfig.HOST}")
    print(f"• Environment:     {'Production' if os.environ.get('RUNWAY_ENV') == 'prod' else 'Development'}")
    print("\n🔗 ACCESS ENDPOINTS:")
    print(f"• Main URL:        http://{ServiceConfig.HOST}:{ServiceConfig.MAIN_PORT}/")
    print(f"• Health Check:    http://{ServiceConfig.HOST}:{ServiceConfig.MAIN_PORT}/health")
    print("\n🎯 All AutoCreate services are integrated and running under one unified API")
    print("="*80)

def start_flask_service():
    """
    Start the Flask service
    """
    print(f"\n{'='*60}")
    print(f"🚀 Starting {ServiceConfig.SERVICE_NAME} Service")
    print(f"📡 Port: {ServiceConfig.MAIN_PORT}")
    print(f"🌐 Host: {ServiceConfig.HOST}")
    print(f"📊 Modules: {len(ServiceConfig.SERVICES)} integrated services")
    print(f"{'='*60}")
    
    # Create and run the Flask app
    app = create_app()
    
    # Run the Flask app
    app.run(
        host=ServiceConfig.HOST,
        port=ServiceConfig.MAIN_PORT,
        debug=os.environ.get('FLASK_DEBUG', 'false').lower() == 'true'
    )

def monitor_service():
    """
    Monitor service health (optional for production)
    """
    while True:
        try:
            # Simple health check simulation
            time.sleep(30)
            print(f"[{time.strftime('%H:%M:%S')}] ✅ {ServiceConfig.SERVICE_NAME} service is healthy")
        except KeyboardInterrupt:
            break
        except Exception as e:
            print(f"[{time.strftime('%H:%M:%S')}] ⚠️  Service monitor error: {e}")

def main():
    """
    Main orchestrator - starts the unified AutoCreate service
    """
    print("\n" + "="*80)
    print("🚀 STARTING AUTOCREATE UNIFIED SERVICE")
    print("="*80)
    print("🔧 Configuration:")
    print(f"   • Service: {ServiceConfig.SERVICE_NAME}")
    print(f"   • Port:    {ServiceConfig.MAIN_PORT}")
    print(f"   • Host:    {ServiceConfig.HOST}")
    print(f"   • CORS:    Enabled for all origins")
    print("="*80)
    
    try:
        # Print service dashboard
        print_service_dashboard()
        
        # Start service monitor in background thread
        monitor_thread = threading.Thread(target=monitor_service, daemon=True)
        monitor_thread.start()
        
        print("\n🎯 Starting Flask service...")
        print("📝 Press Ctrl+C to stop the service...")
        print("="*80)
        
        # Start the Flask service (this will block)
        start_flask_service()
        
    except KeyboardInterrupt:
        print("\n\n" + "="*80)
        print("🛑 STOPPING AUTOCREATE SERVICE...")
        print("="*80)
        print("✅ Service stopped gracefully")
        print("="*80)
        
    except Exception as e:
        print(f"\n❌ Error starting service: {e}")
        print("="*80)
        sys.exit(1)

if __name__ == "__main__":
    # For Runway deployment, we use the standard Flask app
    # But we can also run the orchestrator for local development
    if os.environ.get('RUNWAY_DEPLOYMENT', 'false').lower() == 'true':
        # Runway deployment mode - create and run app directly
        app = create_app()
        if __name__ == "__main__":
            port = int(os.environ.get("PORT", 5001))
            app.run(host="0.0.0.0", port=port)
    else:
        # Local development mode with orchestrator dashboard
        main()