# Seedance Fashion Studio (TandB-seedance-app)

Ứng dụng studio AI chuyên nghiệp hỗ trợ ghép ảnh nhân vật, ảnh thời trang và video tham chiếu để tạo hàng loạt video Seedance với quản lý phiên, storyboard grid, luồng đồng thời và tích hợp API 79AI / Gommo.

## ✨ Tính năng chính

- **Nhập ảnh nhân vật (@image1):** Khóa diện mạo, đường nét khuôn mặt, kiểu tóc và màu da.
- **Nhập ảnh thời trang (@image2):** Khóa trang phục, phụ kiện, chất liệu vải và giày dép.
- **Nhập video tham chiếu (@video1):** Khóa chuyển động nhân vật, góc quay camera, bối cảnh và nhịp điệu.
- **Tích hợp 79AI:** Hỗ trợ nhập Access Token và kết nối trực tiếp với backend 79AI (`79ai.net` / `api.gommo.net`).
- **Storyboard Grid:** Quản lý hàng loạt tác vụ theo phiên (session) với nhiều luồng song song, theo dõi tiến độ thời gian thực.
- **Chế độ Demo Offline:** Sẵn sàng chạy mô phỏng ngay cả khi chưa nhập token.

## 🚀 Hướng dẫn cài đặt và chạy trên Localhost

1. **Cài đặt dependencies:**
   ```bash
   npm install
   ```

2. **Khởi chạy môi trường phát triển (Dev Server):**
   ```bash
   npm run dev
   ```

3. **Mở trình duyệt:**
   Truy cập `http://localhost:5173/` để sử dụng ứng dụng.

## 🔑 Cấu hình 79AI Access Token

1. Đăng nhập tài khoản trên [79ai.net](https://79ai.net).
2. Nhấn `F12` mở DevTools -> Chọn tab **Network** -> Tìm request tới `api.gommo.net`.
3. Copy chuỗi `access_token`.
4. Trên giao diện ứng dụng, bấm nút **"Liên kết 79AI"** ở góc trên bên phải, dán token và bấm **"Lưu & Đồng bộ"**.
