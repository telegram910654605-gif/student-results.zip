// api/upload.js باستخدام PDF.co لاستخراج جدول الطلاب من PDF
const multer = require('multer');
const axios = require('axios');

const upload = multer({ storage: multer.memoryStorage() });

module.exports = (req, res) => {
  if (req.method !== 'POST') {
    return res.status(200).json({ ok: false, error: 'Use POST to upload file' });
  }

  upload.single('file')(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ ok: false, error: 'خطأ في رفع الملف' });
    }

    const file = req.file;
    if (!file) {
      return res.status(400).json({ ok: false, error: 'لم يتم رفع ملف' });
    }

    try {
      const students = await extractStudentsWithPdfCo(file.buffer);

      return res.status(200).json({
        ok: true,
        count: students.length,
        students
      });
    } catch (error) {
      console.error('PDF.co error:', error.response?.data || error.message);
      return res.status(500).json({
        ok: false,
        error: 'خطأ أثناء معالجة ملف PDF'
      });
    }
  });
};

async function extractStudentsWithPdfCo(fileBuffer) {
  const apiKey = process.env.PDFCO_API_KEY;
  if (!apiKey) {
    throw new Error('PDFCO_API_KEY غير مضبوط في بيئة التشغيل');
  }

  const base64Pdf = fileBuffer.toString('base64');

  // Endpoint من PDF.co لتحويل PDF إلى JSON (جداول) [web:6][web:61][web:68][web:72]
  const url = 'https://api.pdf.co/v1/pdf/convert/to/json';

  const body = {
    file: base64Pdf,
    encrypt: false,
    inline: true,
    pages: '0-', // كل الصفحات
    async: false
  };

  const response = await axios.post(url, body, {
    headers: {
      'x-api-key': apiKey,
      'Content-Type': 'application/json'
    }
  });

  // response.data.file تحتوي JSON كنص أو link حسب الإعداد [web:61][web:68][web:72]
  let jsonData;
  if (typeof response.data === 'string') {
    jsonData = JSON.parse(response.data);
  } else if (response.data.body) {
    jsonData = JSON.parse(response.data.body);
  } else if (response.data.json) {
    jsonData = response.data.json;
  } else {
    jsonData = response.data;
  }

  // نحاول إيجاد أول جدول مناسب في البيانات [web:6][web:63][web:71]
  const students = parseStudentsFromPdfCoJson(jsonData);
  return students;
}

// تحويل JSON من PDF.co إلى قائمة طلاب
function parseStudentsFromPdfCoJson(jsonData) {
  const students = [];

  // بنية JSON من PDF.co بتعتمد على الإعداد، هنا نفترض وجود "pages" وفيها "Tables" [web:6][web:63][web:72]
  const pages = jsonData.pages || jsonData.pageObjects || [];
  for (const page of pages) {
    const tables = page.Tables || page.tables || [];
    for (const table of tables) {
      const rows = table.Rows || table.rows || [];
      if (rows.length === 0) continue;

      const headers = rows[0].map(cell => (cell.Text || cell.text || '').trim());

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];

        const getCell = (headerNames) => {
          for (const h of headerNames) {
            const idx = headers.findIndex(x => x.includes(h));
            if (idx !== -1 && row[idx]) {
              return (row[idx].Text || row[idx].text || '').trim();
            }
          }
          return '';
        };

        const name = getCell(['الاسم', 'Name', 'Student']);
        const id = getCell(['رقم', 'ID', 'Seat', 'Reg']);

        const avgStr = getCell(['المعدل', 'Average', 'GPA', 'Total']);
        const average = avgStr ? parseFloat(avgStr.replace(',', '.')) || 0 : 0;

        let status = getCell(['الحالة', 'Status', 'Result']);
        if (!status) {
          status = average >= 50 ? 'ناجح' : 'راسب';
        }

        if (name || id) {
          students.push({
            name,
            id,
            average,
            status,
            rank: students.length + 1
          });
        }
      }
    }
  }

  return students;
}
