# Hướng dẫn Deploy lên Cloud

## Deploy qua GitHub + Vercel (Khuyến nghị)

### Bước 1: Push code lên GitHub

1. **Khởi tạo Git repository (nếu chưa có):**
```bash
git init
git add .
git commit -m "Initial commit"
```

2. **Tạo repository trên GitHub:**
   - Truy cập https://github.com/new
   - Đặt tên repository (ví dụ: `centralized-phone-monitor`)
   - Chọn Public hoặc Private
   - KHÔNG chọn "Initialize with README" (vì đã có code)
   - Click "Create repository"

3. **Push code lên GitHub:**
```bash
git remote add origin https://github.com/USERNAME/REPO_NAME.git
git branch -M main
git push -u origin main
```

### Bước 2: Deploy lên Vercel từ GitHub

1. **Truy cập Vercel:**
   - Vào https://vercel.com
   - Click "Sign Up" hoặc "Login"
   - Chọn "Continue with GitHub"

2. **Import Project:**
   - Click "Add New..." → "Project"
   - Chọn repository vừa tạo
   - Click "Import"

3. **Configure Project:**
   - Framework Preset: Vite (tự động detect)
   - Build Command: `npm run build` (đã set sẵn)
   - Output Directory: `dist` (đã set sẵn)
   - Install Command: `npm install` (đã set sẵn)

4. **Thêm Environment Variables:**
   - Click "Environment Variables"
   - Thêm biến: `GEMINI_API_KEY`
   - Value: API key của bạn
   - Click "Add"

5. **Deploy:**
   - Click "Deploy"
   - Đợi 1-2 phút để build và deploy
   - Nhận được URL như: `https://your-project.vercel.app`

### Bước 3: Cập nhật sau này

Mỗi khi bạn push code mới lên GitHub:
```bash
git add .
git commit -m "Update features"
git push
```

Vercel sẽ tự động build và deploy lại!

## Deploy qua GitHub + Netlify

1. **Push code lên GitHub** (giống bước 1 ở trên)

2. **Deploy trên Netlify:**
   - Vào https://app.netlify.com
   - Click "Add new site" → "Import an existing project"
   - Chọn "GitHub"
   - Chọn repository
   - Build settings:
     - Build command: `npm run build`
     - Publish directory: `dist`
   - Thêm Environment Variables: `GEMINI_API_KEY`
   - Click "Deploy"

## Lưu ý quan trọng

- ⚠️ **Không commit file `.env`** vào Git (đã có trong .gitignore)
- ✅ Luôn set environment variables trên Vercel/Netlify dashboard
- 🔄 Mỗi lần push code mới sẽ tự động deploy
- 🌐 Có thể custom domain sau khi deploy thành công
