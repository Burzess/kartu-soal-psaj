# 🎓 Generator Kartu Soal PSAJ

Web app untuk generate kartu soal PSAJ dengan mudah dan konsisten.

## ✨ Fitur

- ✅ Upload file soal (.txt, .rtf, .doc)
- ✅ Paste teks soal langsung
- ✅ Auto-parse soal, opsi jawaban, dan kunci
- ✅ Preview kartu soal sebelum print/export
- ✅ Export ke PDF
- ✅ Print langsung
- ✅ Format konsisten dan profesional

## 🚀 Cara Menggunakan

### 1. Jalankan Aplikasi

```bash
npm install
npm run dev
```

Buka browser: **http://localhost:3000**

### 2. Format Soal

Format soal yang didukung:

```
1. Teks soal pertama...
a. Opsi A
b. Opsi B
c. Opsi C
d. Opsi D
ANS: A

2. Teks soal kedua...
a. Opsi A
b. Opsi B
c. Opsi C
d. Opsi D
ANS: C
```

**Penanda Kunci Jawaban:**
- `ANS: A` 
- `ANSWER: B`
- `JAWABAN: C`
- `KUNCI: D`

### 3. Input Soal

**Cara 1: Upload File**
- Drag & drop file soal ke area upload
- Support: .txt, .rtf, .doc

**Cara 2: Paste Langsung**
- Copy soal dari Word/Excel
- Paste di text area
- Klik "Parse Soal"

### 4. Isi Metadata

Setelah soal di-parse, isi informasi:
- Mata Pelajaran
- Kelas
- Semester
- Tahun Ajaran

### 5. Export

- **🖨️ Print**: Langsung print kartu soal
- **📄 Export PDF**: Download sebagai PDF

## 📁 Contoh File

Lihat `sample-soal.txt` untuk contoh format soal.

## 🛠️ Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Styling**: TailwindCSS
- **PDF Export**: jsPDF + html2canvas
- **Language**: TypeScript

## 🚢 Deploy ke Vercel (Gratis)

1. Push code ke GitHub
2. Import di Vercel: https://vercel.com/new
3. Deploy otomatis!

---

**Made with ❤️ for SMK 45 Surabaya**
