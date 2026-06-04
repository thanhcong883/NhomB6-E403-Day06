# Batch 02 · Day 06 — AI Product Hackathon
# Tên nhóm: B6 E403

Dự án phát triển **Techcombank Smart Chatbot** - giải pháp hỏi đáp thông tin thông minh tích hợp trên ứng dụng Techcombank Mobile, giúp cải thiện trải nghiệm khách hàng và bảo vệ tài sản của họ trong các trường hợp khẩn cấp.

---

## 👥 Danh Sách Thành Viên Nhóm

| Mã học viên | Họ và Tên | Vai trò chính |
|-------------|-----------|---------------|
| `HV0001` (Ví dụ) | **Giang Thanh Công** | **Product Owner / Spec Lead / Presenter** (Viết SPEC, thiết kế kịch bản, slide pitch) |
| `HV0002` (Ví dụ) | **** | **AI Developer & QA Tester** (Prompt-Engineering, RAG, kiểm thử chất lượng Q&A) |
| `HV0003` (Ví dụ) | **Thành viên 3** | **UI/UX Builder & Frontend Dev** (Xây dựng UI, hoạt cảnh Face ID, Sidebar) |

*(Lưu ý: Vui lòng cập nhật mã học viên và họ tên thực tế của các thành viên trước khi nộp bài)*

---

## 📂 Cấu Trúc Repository

```text
Day06-E403-NhomB6/
├── README.md        ← (Tệp này) Danh sách thành viên + giới thiệu ngắn sản phẩm
├── spec/            ← Hướng dẫn và tài liệu SPEC sản phẩm chi tiết
│   ├── spec.md      ← Tài liệu đặc tả (đã tích hợp bằng chứng và kịch bản lỗi)
│   └── images/      ← Hình ảnh minh họa điểm đau và giao diện ứng dụng
└── codebase/        ← Toàn bộ mã nguồn chạy được của Prototype
    ├── README.md    ← Hướng dẫn cài đặt và chạy thử prototype
    ├── index.html   ← Giao diện mô phỏng ứng dụng di động
    ├── style.css    ← Định dạng giao diện và hiệu ứng động
    ├── app.js       ← Logic xử lý hội thoại, TF-IDF và ReAct Agent
    ├── config.js    ← Tệp cấu hình chứa API Key (đã được làm sạch)
    └── tcb_faq.json ← Cơ sở tri thức câu hỏi thường gặp của Techcombank
```

---

## 🚀 Giới Thiệu Sản Phẩm: Techcombank Smart Chatbot

### 💡 Bối cảnh & Điểm đau
Khách hàng sử dụng Techcombank Mobile thường xuyên gặp bất tiện khi tra cứu thông tin (lãi suất gửi tiết kiệm, biểu phí thẻ thường niên, hạn mức chuyển khoản). Do ứng dụng hiện tại thiếu tính năng tìm kiếm thông minh, người dùng phải thoát khỏi app để tìm kiếm trên Google, gây nguy cơ rò rỉ phiên bảo mật và rủi ro đọc phải thông tin giả mạo hoặc lỗi thời.

### 🌟 Giải pháp: Trợ lý Hỏi đáp thông minh
**Techcombank Smart Chatbot** tích hợp sâu trong ứng dụng di động, mang lại:
1. **Hỏi đáp thông tin tức thời:** Tìm kiếm và phản hồi chính xác câu hỏi trong cơ sở tri thức chính thức bằng ngôn ngữ tự nhiên nhờ thuật toán TF-IDF Search Engine hoặc ReAct AI Agent.
2. **Cảnh báo khẩn cấp (Emergency Filter):** Lọc từ khóa rủi ro (lừa đảo, mất tiền, hack) để đưa ra chỉ dẫn bảo vệ tài sản và nút gọi hotline ngay lập tức (0ms delay).
3. **Khóa thẻ một chạm với Face ID:** Cho phép khóa thẻ khẩn cấp qua chatbot kết hợp xác thực khuôn mặt sinh trắc học (mô phỏng quét lỗi và quét thành công).
4. **Resilience (Kết nối người thật):** Chuyển đổi mượt mà sang Điện thoại viên Thu Trang khi chatbot không chắc chắn về thông tin, lưu giữ nguyên lịch sử chat của khách hàng.

---

## 📖 Hướng Dẫn Truy Cập Nhanh

- Xem tài liệu phân tích và thiết kế sản phẩm chi tiết: [Tài liệu SPEC](file:///c:/Users/giang/Desktop/New%20folder/Batch02-Day06-AI-Product-Hackathon/spec/spec.md).
- Xem hướng dẫn chạy thử giao diện và cài đặt mã nguồn: [Hướng dẫn chạy Codebase](file:///c:/Users/giang/Desktop/New%20folder/Batch02-Day06-AI-Product-Hackathon/codebase/README.md).
