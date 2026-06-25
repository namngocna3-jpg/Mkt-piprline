# SurfSense test kit — bước (3): test API thật trước khi automation

Mục tiêu: dựng SurfSense self-host, ném **1 file tài liệu** vào, sinh thử **video/podcast**,
xác nhận chất lượng + chốt đúng API — **rồi mới** ráp Make (bước 1).

> ⚠️ Không chạy được trong môi trường cloud của Claude (thiếu API key của anh + không có
> host public). Phần này anh chạy trên **máy/VPS của anh**. Script bên dưới lo phần gọi API.

---

## 1. Sự thật về API SurfSense (đã đọc source)

| Việc | Cơ chế | Ổn cho automation? |
|---|---|---|
| Upload tài liệu | `POST /api/v1/documents/fileupload` (multipart) | ✅ REST sạch |
| Lấy / tải video | `GET /api/v1/video-presentations/{id}` → poll `status` tới `ready` | ✅ REST sạch |
| Tải audio từng slide | `GET /api/v1/video-presentations/{id}/slides/{n}/audio` | ✅ |
| **Kích sinh video/podcast** | **Task Celery chạy nền, kích qua agent/chat** (`POST .../messages`), **không** phải 1 REST "generate" bấm-ra-ngay | ⚠️ phải gửi lệnh cho agent rồi poll |

→ Automation khả thi, nhưng nhớ: **upload (REST) → kích sinh (qua agent) → poll (REST) → tải về (REST)**.
Có bước chờ vài phút, nên dùng webhook hoặc poll.

## 2. Cần key gì (bản test rẻ nhất)

- **Auth**: đặt `AUTH_TYPE=LOCAL` để login bằng email/mật khẩu (khỏi Google OAuth).
- **TTS** (giọng đọc video/podcast): `TTS_SERVICE=local/kokoro` → **miễn phí, chạy local**.
- **STT**: `STT_SERVICE=local/base` (Whisper local) → miễn phí.
- **LLM**: bắt buộc có 1 model qua LiteLLM. Rẻ nhất = **Ollama local**; hoặc 1 key provider
  (Gemini/OpenAI/Claude). Đây là chi phí chính.
- **ETL** (đọc PDF/Docx): `ETL_SERVICE=DOCLING` chạy local được; hoặc key Unstructured/LlamaCloud.

→ Có thể test **gần như $0** nếu dùng Ollama + kokoro + docling local.

## 3. Dựng SurfSense (Docker)

```bash
git clone https://github.com/MODSetter/SurfSense.git
cd SurfSense
cp surfsense_backend/.env.example surfsense_backend/.env
# sửa .env: AUTH_TYPE=LOCAL, TTS_SERVICE=local/kokoro, STT_SERVICE=local/base,
#           ETL_SERVICE=DOCLING, cấu hình LLM (Ollama hoặc key provider), DATABASE_URL, REDIS_URL, SECRET_KEY
docker compose up -d      # backend :8000, frontend :3000
```

Mở `http://localhost:8000/docs` để xem Swagger — đây là **nguồn chân lý** về endpoint.
Tạo 1 user (LOCAL), tạo 1 search space, ghi lại `search_space_id`.

## 4. Chạy script test

```bash
SURFSENSE_URL=http://localhost:8000 \
SS_EMAIL=you@example.com SS_PASSWORD=yourpass \
SEARCH_SPACE_ID=1 FILE_PATH=./bai-ly-thuyet-1.pdf \
node surfsense-test/test-surfsense.mjs
```

Script sẽ:
1. Đọc `/openapi.json` → in ra **endpoint thật** (auth / documents / video / podcast / chat).
2. Login lấy JWT.
3. Upload file tài liệu.
4. Poll `/video-presentations` tới khi `status=ready`.

Bước **kích sinh video**: lần đầu nên bấm nút "Generate Video" trong UI cho tài liệu vừa
upload (xem chất lượng), hoặc gọi endpoint nhóm CHAT/AGENT mà script in ra. Khi đã chốt
endpoint đó từ Swagger, ta tự động hoá nốt bước này.

## 5. Tiêu chí đánh giá (để quyết có đầu tư tiếp không)

- [ ] Chất lượng video/giọng đọc có dùng được cho học liệu không?
- [ ] Slide/mindmap sinh ra có sát nội dung bài lý thuyết không?
- [ ] Thời gian sinh 1 video bao lâu? (ảnh hưởng thiết kế poll/webhook)
- [ ] Endpoint kích sinh ổn định (đọc rõ từ `/docs`) chưa?

## 6. Bước tiếp (1) — Make

Khi (3) OK: dựng SurfSense sau **Cloudflare Tunnel / domain public** để Make cloud gọi vào,
rồi tạo scenario Make bằng **module HTTP**:

```
[Watch Google Drive folder] → [HTTP login lấy JWT] → [HTTP upload /documents/fileupload]
   → [HTTP kích sinh qua agent] → [poll /video-presentations tới ready] → [tải về → Drive/Telegram]
```

Claude đang nối sẵn Make MCP trong session — báo "làm Make đi" là dựng scenario thật luôn.
