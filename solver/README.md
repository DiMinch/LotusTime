# LotusTime Solver

Microservice tính toán Thời Khóa Biểu thông minh cho hệ thống LotusTime.

## Công nghệ sử dụng
- Python 3
- Flask
- Google OR-Tools (CP-SAT Solver)

## Kiến trúc thuật toán
Solver nhận đầu vào là file JSON tổng hợp dữ liệu (Persons, Classes, Rooms, Availability, Constraints, Pins) từ Backend.
Sau đó, solver mã hóa các giới hạn (Hard Constraints) và tối ưu hóa (Soft Constraints) để trả về một lịch biểu hợp lệ nhất.

### Constraints chính:
- Không trùng lặp: Một giáo viên/phòng không thể dạy 2 lớp cùng lúc.
- Lớp học cần TA phải có TA được phân công.
- Tuân thủ Availability Matrix.
- Tối ưu hóa: Đảm bảo số lượng buổi / tuần như thiết lập.

## Hướng dẫn
```bash
pip install -r requirements.txt
python app.py
```

Server chạy tại cổng `8000`.
