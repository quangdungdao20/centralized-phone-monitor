# Hướng dẫn kết nối Firebase Realtime Database

## Bước 1: Tạo Firebase Project

1. **Truy cập Firebase Console:**
   - Vào https://console.firebase.google.com
   - Đăng nhập bằng tài khoản Google

2. **Tạo project mới:**
   - Click "Add project" hoặc "Tạo dự án"
   - Đặt tên project: `v-monitor-pro` (hoặc tên bạn thích)
   - Click "Continue"
   - Tắt Google Analytics (không cần thiết) hoặc để mặc định
   - Click "Create project"
   - Đợi 30 giây cho Firebase khởi tạo

## Bước 2: Tạo Realtime Database

1. **Trong Firebase Console:**
   - Mở project vừa tạo
   - Sidebar bên trái → Click "Realtime Database"
   - Click "Create Database"

2. **Chọn location:**
   - Chọn `asia-southeast1` (Singapore) - gần Việt Nam nhất
   - Click "Next"

3. **Security rules:**
   - Chọn "Start in **test mode**" (để test, sau này sẽ đổi)
   - Click "Enable"

4. **Lấy Database URL:**
   - Sau khi tạo xong, bạn sẽ thấy URL dạng:
   ```
   https://YOUR-PROJECT-ID-default-rtdb.asia-southeast1.firebasedatabase.app
   ```
   - Copy URL này

## Bước 3: Cấu hình Security Rules (Quan trọng!)

1. **Trong Realtime Database Console:**
   - Tab "Rules"
   - Thay thế rules hiện tại bằng:

```json
{
  "rules": {
    "rooms": {
      "$roomId": {
        "signals": {
          ".read": true,
          ".write": true,
          ".indexOn": ["timestamp", "to", "from"],
          "$signalId": {
            ".validate": "newData.hasChildren(['from', 'to', 'timestamp'])"
          }
        }
      }
    }
  }
}
```

2. Click **"Publish"**

## Bước 4: Cấu hình trong project

1. **Tạo file `.env` trong project:**
```env
GEMINI_API_KEY=your_gemini_api_key_here
VITE_FIREBASE_URL=https://YOUR-PROJECT-ID-default-rtdb.asia-southeast1.firebasedatabase.app/rooms/vmonitor_global_room_001
```

2. **Thay thế `YOUR-PROJECT-ID`** bằng project ID thực tế của bạn

## Bước 5: Test kết nối

1. **Chạy dev server:**
```bash
npm run dev
```

2. **Mở trình duyệt:**
   - Vào http://localhost:3000
   - Click "Quét thiết bị" để tạo QR code
   - Mở điện thoại, quét QR code

3. **Kiểm tra Firebase Console:**
   - Vào Realtime Database → Data tab
   - Bạn sẽ thấy dữ liệu xuất hiện trong `rooms/vmonitor_global_room_001/signals`

## Bước 6: Deploy lên Vercel

1. **Thêm Environment Variable trên Vercel:**
   - Vào Vercel Dashboard → Project Settings
   - Tab "Environment Variables"
   - Thêm:
     - Name: `VITE_FIREBASE_URL`
     - Value: `https://YOUR-PROJECT-ID-default-rtdb.asia-southeast1.firebasedatabase.app/rooms/vmonitor_global_room_001`
   - Click "Save"

2. **Redeploy:**
   - Vercel sẽ tự động deploy lại
   - Hoặc manual: Settings → Deployments → Redeploy

## Cấu trúc dữ liệu Firebase

Firebase sẽ lưu dữ liệu theo cấu trúc:
```
rooms/
  └── vmonitor_global_room_001/
      └── signals/
          ├── -NXxxx1: { from: "DEV-ABC", to: "DASHBOARD", type: "JOIN", ... }
          ├── -NXxxx2: { from: "DASHBOARD", to: "DEV-ABC", type: "OFFER", ... }
          └── -NXxxx3: { from: "DEV-ABC", to: "DASHBOARD", type: "ANSWER", ... }
```

## Lưu ý bảo mật

⚠️ **Rules hiện tại cho phép mọi người đọc/ghi** - chỉ dùng để test!

Sau khi test xong, nên đổi rules sang:
```json
{
  "rules": {
    "rooms": {
      "$roomId": {
        "signals": {
          ".read": "auth != null",
          ".write": "auth != null"
        }
      }
    }
  }
}
```

Và implement Firebase Authentication để bảo mật hơn.

## Troubleshooting

**Lỗi CORS:**
- Firebase Realtime Database không có vấn đề CORS
- Nếu gặp lỗi, kiểm tra lại URL

**Không thấy dữ liệu:**
- Kiểm tra Security Rules đã publish chưa
- Kiểm tra URL có đúng format không
- Mở Console → Network tab để xem request

**Kết nối chậm:**
- Chọn database region gần Việt Nam (asia-southeast1)
- Xem xét nâng cấp Firebase plan nếu cần
