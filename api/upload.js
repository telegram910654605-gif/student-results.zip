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
      const students = await extractStudentsWithGemini(file.buffer);

      return res.status(200).json({
        ok: true,
        count: students.length,
        students
      });
    } catch (error) {
      console.error('Gemini error:', error.response?.data || error.message);
      return res.status(500).json({
        ok: false,
        error: 'خطأ أثناء معالجة الملف بالذكاء الاصطناعي'
      });
    }
  });
};

async function extractStudentsWithGemini(fileBuffer) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY غير مضبوط في بيئة التشغيل');
  }

  const base64Pdf = fileBuffer.toString('base64');

  const url =
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=' +
    apiKey;

  const body = {
    contents: [
      {
        parts: [
          {
            text: `
أنت نظام متخصص في استخراج نتائج الطلاب من ملفات PDF.
ملف PDF المرفق يحتوي على جدول أو أكثر لنتائج طلاب (باللغة العربية أو الإنجليزية).

المطلوب:
- استخرج قائمة الطلاب فقط.
- أعد النتيجة بصيغة JSON فقط بدون أي نص إضافي.
- الشكل المطلوب للـ JSON:
[
  {
    "name": "اسم الطالب",
    "id": "رقم القيد أو رقم الجلوس",
    "average": 80.5,
    "status": "ناجح" أو "راسب"
  }
]

ملاحظات:
- لو ما في معدل واضح، احسب المتوسط التقريبي من الدرجات إن وجدت، ولو تعذر، خلي average = 0.
- لو ما في حالة مكتوبة، استخدم "غير محدد".
- تأكد أن الـ JSON صالح وقابل للـ parse في جافاسكربت.
`
          },
          {
            inlineData: {
              mimeType: 'application/pdf',
              data: base64Pdf
            }
          }
        ]
      }
    ]
  };

  const response = await axios.post(url, body);

  const text = response.data.candidates?.[0]?.content?.parts?.[0]?.text || '';

  const start = text.indexOf('[');
  const end = text.lastIndexOf(']');

  if (start === -1 || end === -1) {
    throw new Error('تعذر استخراج JSON من رد Gemini');
  }

  const jsonString = text.slice(start, end + 1);

  let rawStudents;
  try {
    rawStudents = JSON.parse(jsonString);
  } catch (e) {
    console.error('JSON parse error:', e.message);
    throw new Error('JSON غير صالح من رد Gemini');
  }

  const students = rawStudents.map((s, idx) => ({
    name: s.name || '',
    id: s.id ? String(s.id) : '',
    average: Number(s.average) || 0,
    status: s.status || 'غير محدد',
    rank: idx + 1
  }));

  return students;
}
