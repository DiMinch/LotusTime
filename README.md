# LotusTime Scheduling System

Hệ thống xếp lịch tự động thông minh dành cho trung tâm Anh ngữ Lotus.
Dự án được thiết kế dưới dạng Monorepo bao gồm 3 thành phần chính:

## Kiến trúc Hệ thống

- **Frontend (`/frontend`)**: Ứng dụng ReactJS sử dụng Vite. Giao diện thiết kế theo chuẩn NVIDIA (Double-bezel, màu Dark + Green/Pink highlight).
- **Backend (`/backend`)**: API Server xây dựng bằng Node.js & Express. Quản lý dữ liệu qua PostgreSQL và sử dụng AI NLP (Gemini) để xử lý ràng buộc tự do.
- **Solver (`/solver`)**: Microservice viết bằng Python sử dụng Flask & Google OR-Tools (CP-SAT Solver). Đây là trái tim của hệ thống để tính toán và giải quyết bài toán xếp lịch phức tạp.

## Yêu cầu môi trường
- Node.js >= 18
- Python >= 3.10
- Docker & Docker Compose (cho PostgreSQL database)

## Hướng dẫn chạy
1. Khởi chạy Database:
   ```bash
   docker-compose up -d
   ```
2. Chạy Backend:
   ```bash
   cd backend
   npm install
   npm start
   ```
3. Chạy Frontend:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
4. Chạy Solver:
   ```bash
   cd solver
   pip install -r requirements.txt
   python app.py
   ```
