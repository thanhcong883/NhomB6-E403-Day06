# Codebase - Hướng Dẫn Chạy Prototype & Cấu Hình

Thư mục này chứa toàn bộ mã nguồn của **Techcombank AI Chatbot Prototype**, một trợ lý ảo hỗ trợ hỏi đáp trực tuyến thông minh (lãi suất, biểu phí, thẻ, tài khoản) tích hợp trực tiếp trên giao diện Techcombank Mobile.

---

## 1. Hướng dẫn chạy nhanh (Quick Start)

### Bước 1: Khởi chạy HTTP Server cục bộ
Sử dụng Python để chạy một server tĩnh ngay tại thư mục `codebase/`:
```bash
# Di chuyển vào thư mục codebase (nếu chưa ở đó)
cd codebase

# Khởi chạy server tĩnh
python -m http.server 8000
```

### Bước 2: Truy cập ứng dụng
Mở trình duyệt bất kỳ và truy cập vào địa chỉ:
👉 **[http://localhost:8000](http://localhost:8000)**

---

## 2. Cấu hình API Keys (LLM) để kích hoạt ReAct Agent

Mặc định, chatbot sẽ tự động chạy bằng công cụ tìm kiếm cục bộ **TF-IDF Search Engine** (không cần API Key). Để nâng cấp chatbot thành **ReAct Agent** thông minh có khả năng suy luận từng bước, bạn cần cấu hình API Key:

### Cách 1: Qua giao diện ứng dụng (Khuyên dùng)
1. Nhấp vào **biểu tượng bánh răng (Settings)** ở góc trên cùng bên phải khung chat.
2. Nhập API Key của bạn (OpenAI hoặc Mistral).
3. Chọn mô hình tương ứng (ví dụ: `gpt-4o-mini` hoặc `mistral-large-latest`).
4. Nhấp **Lưu Cấu Hình**.
*(API Key sẽ được lưu an toàn trong trình duyệt của bạn qua localStorage)*

### Cách 2: Qua tệp `config.js`
1. Đổi tên tệp `config.js.example` thành `config.js` (hoặc sửa trực tiếp tệp `config.js` hiện có).
2. Điền khóa API vào trường `OPENAI_API_KEY` hoặc `MISTRAL_API_KEY`:
```javascript
window.ENV = {
    OPENAI_API_KEY: "sk-proj-YOUR_ACTUAL_API_KEY",
    OPENAI_MODEL: "gpt-4o-mini",
    MISTRAL_API_KEY: "YOUR_ACTUAL_MISTRAL_API_KEY",
    MISTRAL_MODEL: "mistral-large-latest"
};
```
*Lưu ý: Tệp `config.js` chứa key thực tế nên được thêm vào `.gitignore` để tránh rò rỉ mã bảo mật lên GitHub.*

---

## 3. Các Công Cụ & Mô Hình Sử Dụng
- **Mô hình AI:** `gpt-4o-mini` (OpenAI), `mistral-large-latest` (Mistral AI).
- **Mô hình tìm kiếm cục bộ (Fallback):** Thuật toán TF-IDF kết hợp Cosine Similarity tìm câu hỏi FAQ gần nhất.
- **Frontend UI:** HTML5, CSS3, Vanilla JS (không dùng thư viện ngoài ngoại trừ bộ icon FontAwesome).

---

## 4. Phân công đóng góp (Team Roles)

- **Giang Thanh Công** (Product Owner / Spec Lead / Presenter): Viết tài liệu SPEC, thiết kế kịch bản giảm thiểu ảo giác, thiết lập cấu trúc repo và kịch bản demo.
- **Thành viên 2** (AI Developer & QA Tester): Phát triển cấu trúc Prompt-Engineering cho ReAct Agent, thu thập dữ liệu FAQ ngân hàng thực tế (`tcb_faq.json`) và kiểm thử chất lượng Q&A.
- **Thành viên 3** (UI/UX Builder & Frontend Dev): Xây dựng giao diện mô phỏng điện thoại di động, thanh menu Sidebar, trang Help & Support, khung chat nổi và hiệu ứng Face ID động.
