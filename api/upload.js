// api/upload.js
// نقطة استقبال ملف PDF من الواجهة وإرجاع بيانات طلاب تجريبية

const multer = require('multer');

// تخزين الملف في الذاكرة (Buffer) لأننا حالياً ما بنحفظه في ديسك
const upload = multer({ storage: multer.memoryStorage() });

module.exports = (req, res) => {
  // نسمح فقط بطلبات POST
  if (req.method !== 'POST') {
    return res.status(200).json({ ok: false, error: 'Use POST to upload file' });
  }

  // قراءة ملف واحد اسمه "file" (نفس اسم input في الواجهة)
  upload.single('file')(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ ok: false, error: 'خطأ في رفع الملف' });
    }

    const file = req.file;
    if (!file) {
      return res.status(400).json({ ok: false, error: 'لم يتم رفع ملف' });
    }

    try {
      // حالياً: استخدام بيانات تجريبية (dummy) بدون تحليل حقيقي للـ PDF
      const students = getDummyStudents();

      return res.status(200).json({
        ok: true,
        count: students.length,
        students
      });
    } catch (error) {
      console.error('Upload error:', error.message);
      return res.status(500).json({
        ok: false,
        error: 'خطأ داخلي في معالجة الملف'
      });
    }
  });
};

// بيانات طلاب تجريبية بنفس الشكل الذي تستخدمه الواجهة
function getDummyStudents() {
  return [
    { name: 'أحمد محمد', id: '2025001', average: 82.5, status: 'ناجح', rank: 1 },
    { name: 'سارة علي', id: '2025002', average: 74.3, status: 'ناجح', rank: 2 },
    { name: 'محمود حسن', id: '2025003', average: 49.8, status: 'راسب', rank: 3 }
  ];
}
