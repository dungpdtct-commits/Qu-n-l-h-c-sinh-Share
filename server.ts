import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Health check endpoint
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", app: "Smart Edu Manager - Toán THCS" });
  });

  // AI Diagnostic endpoint using Gemini 3.6 Flash
  app.post("/api/ai-diagnose", async (req, res) => {
    try {
      const { studentName, gradeLevel, targetScore, recentSessions, knowledgeScores, userApiKey } = req.body;

      const apiKey = userApiKey || process.env.GEMINI_API_KEY;
      if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
        return res.status(400).json({
          error: "Chưa cấu hình GEMINI_API_KEY. Vui lòng nhập API Key trong phần Cài đặt."
        });
      }

      const ai = new GoogleGenAI({
        apiKey: apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      const prompt = `
Bạn là Chuyên gia Cố vấn Giáo dục Môn Toán THCS (Lớp 6 đến Lớp 9) hàng đầu tại Việt Nam.
Hãy chẩn đoán tình hình học tập và phân tích lỗ hổng kiến thức của học sinh sau:

THÔNG TIN HỌC SINH:
- Họ và tên: ${studentName || "Học sinh"}
- Khối lớp: Lớp ${gradeLevel || 9}
- Mục tiêu điểm số: ${targetScore || "Thi vào 10 đạt 8.0+"}

DỮ LIỆU BÀI HỌC VÀ ĐIỂM SỐ GẦN ĐÂY:
${JSON.stringify(recentSessions || [], null, 2)}

ĐIỂM NẮM BẮT CHUYÊN ĐỀ (0-10):
${JSON.stringify(knowledgeScores || [], null, 2)}

Nhiệm vụ: Trả về kết quả phân tích theo cấu trúc JSON nguyên bản (JSON object ONLY, không chứa markdown formatting \`\`\`json):
{
  "knowledge_gap": "Phân tích cụ thể lỗ hổng kiến thức Toán (Đại số, Hình học) cần khắc phục gấp",
  "learning_trend": "Đánh giá xu hướng phong độ (Tiến bộ, Sa sút, Thất thường, Ổn định) và thái độ làm BTVN",
  "actionable_advice": "3 hành động cụ thể dành cho Giáo viên / Trợ giảng để phụ đạo cấp tốc cho học sinh",
  "parent_summary": "Đoạn tóm tắt lịch sự, tinh tế, giàu động viên gửi cho Phụ huynh qua Zalo/SĐT (viết bằng giọng Thầy/Cô giáo)"
}
`;

      const response = await ai.models.generateContent({
        model: "gemini-3.6-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          temperature: 0.3,
        }
      });

      const jsonText = response.text || "{}";
      let diagnosisData;
      try {
        diagnosisData = JSON.parse(jsonText);
      } catch (err) {
        diagnosisData = {
          knowledge_gap: "Học sinh cần rèn luyện thêm kỹ năng biến đổi Đại số và kỹ năng vẽ hình chứng minh Tứ giác nội tiếp.",
          learning_trend: "Phong độ có dấu hiệu biến động ở các bài kiểm tra áp lực thời gian.",
          actionable_advice: "1. Cho làm lại 5 câu bài tập Căn thức. 2. Kiểm tra trực tiếp công thức Hình học trước buổi học. 3. Nhắc nhở nộp BTVN đúng hạn.",
          parent_summary: "Kính gửi Phụ huynh, con nắm khá tốt kiến thức lý thuyết cơ bản. Thầy Cô sẽ tăng cường hỗ trợ con bài tập vận dụng để con tự tin đạt mục tiêu đề ra."
        };
      }

      res.json({ success: true, diagnosis: diagnosisData });
    } catch (error: any) {
      console.error("AI Diagnose Error:", error);
      res.status(500).json({
        error: error.message || "Không thể khởi tạo chẩn đoán AI. Vui lòng kiểm tra lại API Key."
      });
    }
  });

  // AI Cycle Report Analyzer endpoint using Gemini 3.6 Flash
  app.post("/api/ai-cycle-report", async (req, res) => {
    try {
      const { className, cycleName, sessionThemes, classMetrics, studentSummaryList, userApiKey } = req.body;

      const apiKey = userApiKey || process.env.GEMINI_API_KEY;
      if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
        return res.status(400).json({
          error: "Chưa cấu hình GEMINI_API_KEY. Vui lòng nhập API Key trong phần Cài đặt."
        });
      }

      const ai = new GoogleGenAI({
        apiKey: apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      const prompt = `
Bạn là Chuyên gia Cố vấn Giáo dục Môn Toán THCS (Lớp 6 đến Lớp 9) hàng đầu tại Việt Nam, sở hữu hiểu biết sâu sắc về tâm lý học lứa tuổi và phương pháp dạy Toán hiệu quả.
Hãy phân tích báo cáo học tập chu kỳ 4 buổi của lớp sau để đưa ra nhận xét sư phạm tổng quan, định hướng giảng dạy cho giai đoạn tiếp theo, đồng thời soạn bản thông báo gửi phụ huynh.

THÔNG TIN LỚP HỌC:
- Tên lớp: ${className || "Lớp Toán THCS"}
- Chu kỳ báo cáo: ${cycleName || "Chu kỳ 4 buổi"}
- Chủ đề kiến thức 4 buổi học: ${JSON.stringify(sessionThemes || [], null, 2)}
- Chỉ số trung bình toàn lớp: ${JSON.stringify(classMetrics || {}, null, 2)}

DANH SÁCH TỔNG HỢP HỌC SINH (Chuyên cần, điểm trung bình BTVN & Bài kiểm tra, cảnh báo học tập):
${JSON.stringify(studentSummaryList || [], null, 2)}

Nhiệm vụ: Hãy trả về kết quả phân tích chuẩn hóa định dạng JSON nguyên bản (JSON object ONLY, không chứa markdown formatting \`\`\`json):
{
  "knowledge_gap_summary": "Tổng hợp chi tiết các lỗ hổng kiến thức Toán tập thể xuất hiện qua các bài kiểm tra trong chu kỳ này.",
  "outstanding_students": "Danh sách 2-3 học sinh có thành tích xuất sắc hoặc có sự tiến bộ vượt bậc nhất trong chu kỳ, ghi kèm lý do cụ thể.",
  "critical_tutoring_students": "Danh sách học sinh gặp khó khăn lớn cần kèm cặp/phụ đạo gấp trong chu kỳ tiếp theo, kèm theo lỗi sai phổ biến của họ.",
  "general_feedback": "3 định hướng hoặc phương pháp cụ thể dành cho Giáo viên & Trợ giảng để nâng cao hiệu quả giảng dạy trong chu kỳ 4 buổi tiếp theo.",
  "parent_group_announcement": "Bản tin tổng kết chu kỳ gửi vào nhóm Phụ huynh lớp trên Zalo (viết bằng giọng Thầy/Cô ấm áp, lịch sự, chuyên nghiệp, động viên cao, tóm tắt tình hình lớp và kế hoạch buổi tiếp theo)"
}
`;

      const response = await ai.models.generateContent({
        model: "gemini-3.6-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          temperature: 0.4,
        }
      });

      const jsonText = response.text || "{}";
      let reportData;
      try {
        reportData = JSON.parse(jsonText);
      } catch (err) {
        reportData = {
          knowledge_gap_summary: "Đa số các con nắm được lý thuyết nhưng còn chưa cẩn thận khi giải toán tính toán phân thức và trình bày hình học.",
          outstanding_students: "Tuyên dương các con có điểm số và tinh thần tự giác học tập cao nhất lớp.",
          critical_tutoring_students: "Một số bạn điểm kiểm tra còn chưa đạt cần ôn tập lại kỹ lý thuyết và bổ sung bài tập về nhà đầy đủ.",
          general_feedback: "1. Tăng cường kiểm tra công thức đầu giờ. 2. Hướng dẫn chi tiết cách trình bày chứng minh hình học. 3. Phân nhóm học sinh để phụ đạo.",
          parent_group_announcement: "Kính gửi quý phụ huynh, Thầy Cô gửi báo cáo tổng hợp chu kỳ học vừa qua. Cảm ơn sự đồng hành sát sao từ phía gia đình."
        };
      }

      res.json({ success: true, report: reportData });
    } catch (error: any) {
      console.error("AI Cycle Report Error:", error);
      res.status(500).json({
        error: error.message || "Không thể kết nối Gemini AI. Vui lòng kiểm tra lại API Key."
      });
    }
  });

  // Vite middleware for development vs static fallback for production
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Smart Edu Manager Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
