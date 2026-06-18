# romper_pdf.py

entrada = "original.pdf"
salida = "original_roto.pdf"

with open(entrada, "rb") as f:
    data = bytearray(f.read())

# rompe bytes importantes al final del PDF
for i in range(max(0, len(data) - 200), len(data)):
    data[i] = 0

# agrega peso extra opcional
data += b"\x00" * 100_000

with open(salida, "wb") as f:
    f.write(data)

print("PDF corrupto creado:", salida)