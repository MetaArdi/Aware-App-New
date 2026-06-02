import sys, os

# Menambahkan path folder aplikasi ke sistem
sys.path.append(os.getcwd())

# Menggunakan bridge untuk menjalankan FastAPI (ASGI) di lingkungan WSGI
from a2wsgi import ASGIMiddleware
from main import app  # Memanggil file main.py dan variabel app 

application = ASGIMiddleware(app)