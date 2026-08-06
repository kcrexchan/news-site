"""Launcher that starts serve.py in a daemon thread so the script exits."""
import threading
import sys
import os

# Change to the script's directory
os.chdir(os.path.dirname(os.path.abspath(__file__)))

# Import and run serve in a background thread
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import serve

def run_server():
    server = serve.ThreadingProxyHandler(("", serve.PORT), serve.ProxyHandler)
    print(f"Server started on port {serve.PORT}")
    server.serve_forever()

t = threading.Thread(target=run_server, daemon=True)
t.start()
print("Server started in background thread")

# Keep alive
import time
while True:
    time.sleep(60)
