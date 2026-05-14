"""
Jalankan sekali untuk inisialisasi database dengan data awal.
Usage: cd backend && python init_db.py
"""
from models.database import Base, engine, SessionLocal, User, Employee
from core.auth import hash_password
from sqlalchemy.exc import IntegrityError

Base.metadata.create_all(bind=engine)
db = SessionLocal()

def add_user_employee(employee_number, email, password, role, name, division, shift):
    try:
        # Cek apakah sudah ada
        existing = db.query(User).filter(User.employee_number == employee_number).first()
        if existing:
            print(f"  ⏭  {employee_number} sudah ada, dilewati.")
            return

        user = User(
            employee_number=employee_number,
            email=email,
            password=hash_password(password),
            role=role
        )
        db.add(user)
        db.flush()

        if name:
            emp = Employee(user_id=user.id, name=name, division=division, shift=shift)
            db.add(emp)

        db.commit()
        print(f"  ✅ {role}: {employee_number} / {password}")
    except IntegrityError:
        db.rollback()
        print(f"  ❌ Gagal menambah {employee_number}")

print("\n🔧 Inisialisasi database AWARE...\n")

add_user_employee("ADMIN-001",   "admin@aware.com",      "admin123",  "admin",      "System Admin",  "IT",        "All")
add_user_employee("SV-2023-001", "supervisor@aware.com", "super123",  "supervisor", "Admin Alpha",   "K3",        "Alpha-7")
add_user_employee("AW-2023-001", None,                   "budi123",   "employee",   "Budi Santoso",  "Produksi",  "Pagi")
add_user_employee("AW-2023-002", None,                   "siti123",   "employee",   "Siti Aminah",   "Logistik",  "Sore")
add_user_employee("AW-2023-003", None,                   "rian123",   "employee",   "Rian Hidayat",  "Produksi",  "Malam")
add_user_employee("AW-2023-004", None,                   "andi123",   "employee",   "Andi Wijaya",   "Teknik",    "Pagi")
add_user_employee("AW-2023-005", None,                   "dewi123",   "employee",   "Dewi Lestari",  "Keuangan",  "Pagi")

print("\n✅ Database berhasil diinisialisasi!")
print("\nAkun tersedia:")
print("  Supervisor : SV-2023-001 / super123")
print("  Karyawan   : AW-2023-001 / budi123")
db.close()