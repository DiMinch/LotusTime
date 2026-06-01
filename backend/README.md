# LotusTime Backend

API Server phục vụ dữ liệu cho LotusTime.

## Công nghệ sử dụng
- Node.js & Express
- PostgreSQL (Thư viện `pg`)
- Google Generative AI (`@google/generative-ai` model gemini-3.5-flash)

## Chức năng
- Cung cấp RESTful API cho toàn bộ các thực thể (Persons, Classes, Rooms, TimeSlots, Weeks).
- Tích hợp tính năng AI NLP: Xử lý chuỗi văn bản do người dùng nhập để trích xuất JSON các ràng buộc cứng/mềm.
- Đóng vai trò cầu nối giao tiếp với microservice Solver (Python) qua giao thức HTTP.

## Hướng dẫn
```bash
# Thiết lập biến môi trường trong file .env trước
npm install
npm start
```

API mặc định chạy tại cổng `5000`.
