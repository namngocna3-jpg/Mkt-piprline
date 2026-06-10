export type Template = { id: string; category: string; title: string; prompt: string };

export const CATEGORIES = [
  'Phân tích kinh doanh',
  'Marketing Strategy',
  'Content & Copy',
  'Email & Communication',
  'Sáng tạo & Branding',
  'Research & Data',
  'Tâm lý khách hàng',
  'Phát triển sản phẩm',
];

export const TEMPLATES: Template[] = [
  // Phân tích kinh doanh
  { id: 'biz-swot', category: 'Phân tích kinh doanh', title: 'SWOT analysis', prompt: 'Hãy làm phân tích SWOT chi tiết cho doanh nghiệp/dự án [TÊN DOANH NGHIỆP] trong ngành [NGÀNH]. Đưa ra ít nhất 4 yếu tố mỗi mục, kèm action item.' },
  { id: 'biz-bmc', category: 'Phân tích kinh doanh', title: 'Business Model Canvas', prompt: 'Vẽ Business Model Canvas đầy đủ 9 ô cho [DOANH NGHIỆP/Ý TƯỞNG]. Mỗi ô liệt kê 3-5 ý cụ thể, không nói chung chung.' },
  { id: 'biz-vpc', category: 'Phân tích kinh doanh', title: 'Value Proposition Canvas', prompt: 'Làm Value Proposition Canvas cho sản phẩm [SẢN PHẨM] hướng tới khách hàng [PHÂN KHÚC]. Phân tích pain, gain, jobs-to-be-done và mapping với value proposition.' },
  { id: 'biz-pricing', category: 'Phân tích kinh doanh', title: 'Chiến lược định giá', prompt: 'Đề xuất 3 chiến lược định giá khả thi cho [SẢN PHẨM] tại thị trường [THỊ TRƯỜNG]. So sánh ưu/nhược điểm và gợi ý mức giá cụ thể.' },
  { id: 'biz-journey', category: 'Phân tích kinh doanh', title: 'Customer Journey Map', prompt: 'Vẽ customer journey map 5 giai đoạn (awareness → advocacy) cho khách hàng [PHÂN KHÚC] khi mua [SẢN PHẨM]. Mỗi giai đoạn: touchpoint, cảm xúc, pain point, cơ hội tối ưu.' },
  { id: 'biz-breakeven', category: 'Phân tích kinh doanh', title: 'Break-even analysis', prompt: 'Tính break-even cho dự án [DỰ ÁN] với CapEx [SỐ TIỀN], chi phí cố định/tháng [SỐ TIỀN], biên gross margin [%]. Trả về số đơn vị/doanh thu hoà vốn + phân tích sensitivity.' },
  { id: 'biz-competitor', category: 'Phân tích kinh doanh', title: 'Competitor analysis', prompt: 'Phân tích 5 đối thủ trực tiếp của [DOANH NGHIỆP] trong [NGÀNH/KHU VỰC]. Mỗi đối thủ: định vị, USP, mức giá, kênh phân phối, điểm yếu khai thác được.' },
  { id: 'biz-market', category: 'Phân tích kinh doanh', title: 'Market sizing TAM/SAM/SOM', prompt: 'Ước lượng TAM/SAM/SOM cho [SẢN PHẨM] tại [VIỆT NAM/ĐNA] kèm logic tính và nguồn dữ liệu giả định.' },

  // Marketing Strategy
  { id: 'mkt-12m', category: 'Marketing Strategy', title: 'Marketing plan 12 tháng', prompt: 'Xây kế hoạch marketing 12 tháng cho [DOANH NGHIỆP], ngân sách [SỐ TIỀN]. Chia quý, objective, KPI, kênh, content pillar.' },
  { id: 'mkt-funnel', category: 'Marketing Strategy', title: 'Marketing funnel', prompt: 'Thiết kế full funnel TOFU/MOFU/BOFU cho [SẢN PHẨM]. Mỗi tầng: content type, kênh, KPI, công cụ đo lường, conversion goal.' },
  { id: 'mkt-omni', category: 'Marketing Strategy', title: 'Omni-channel strategy', prompt: 'Đề xuất chiến lược omni-channel cho [DOANH NGHIỆP] kết hợp online + offline. Vẽ flow trải nghiệm khách hàng xuyên kênh.' },
  { id: 'mkt-launch', category: 'Marketing Strategy', title: 'Product launch plan', prompt: 'Lập launch plan 90 ngày cho [SẢN PHẨM]: pre-launch 30 ngày, launch week, post-launch 60 ngày. KPI và timeline cụ thể.' },
  { id: 'mkt-persona', category: 'Marketing Strategy', title: 'Buyer persona', prompt: 'Tạo 3 buyer persona chi tiết cho [SẢN PHẨM]: demographic, psychographic, jobs-to-be-done, kênh tiếp cận, kích hoạt mua hàng.' },
  { id: 'mkt-segment', category: 'Marketing Strategy', title: 'Segmentation & targeting', prompt: 'Chia thị trường [NGÀNH/KHU VỰC] thành 4-6 segment, đánh giá attractiveness mỗi segment và đề xuất 2 segment ưu tiên.' },
  { id: 'mkt-budget', category: 'Marketing Strategy', title: 'Phân bổ ngân sách', prompt: 'Phân bổ ngân sách marketing [SỐ TIỀN/tháng] cho [DOANH NGHIỆP] theo kênh: Meta, Google, TikTok, KOL, content, email. Giải thích logic phân bổ.' },
  { id: 'mkt-kpi', category: 'Marketing Strategy', title: 'KPI framework', prompt: 'Đề xuất framework KPI cho phòng Marketing của [DOANH NGHIỆP]: bắc cầu từ business objective xuống team KPI rồi xuống personal KPI.' },

  // Content & Copy
  { id: 'con-fb', category: 'Content & Copy', title: 'Facebook caption', prompt: 'Viết 3 phiên bản caption Facebook cho bài đăng về [CHỦ ĐỀ]. Mỗi caption: hook mạnh, body cuốn, CTA rõ ràng, gợi ý emoji.' },
  { id: 'con-email', category: 'Content & Copy', title: 'Email marketing', prompt: 'Viết 1 email marketing cho [DOANH NGHIỆP] gửi tới [PHÂN KHÚC] về [SẢN PHẨM/CHƯƠNG TRÌNH]. Subject A/B, preheader, body 150-200 từ, CTA.' },
  { id: 'con-landing', category: 'Content & Copy', title: 'Landing page copy', prompt: 'Viết copy landing page bán [SẢN PHẨM]: hero headline + subhead, 3 benefit blocks, social proof, FAQ 5 câu, CTA chính.' },
  { id: 'con-seo', category: 'Content & Copy', title: 'SEO title + meta', prompt: 'Đề xuất 5 title (≤60 ký tự) và meta description (≤155 ký tự) tối ưu CTR cho bài viết về [CHỦ ĐỀ], target keyword [TỪ KHOÁ].' },
  { id: 'con-tiktok', category: 'Content & Copy', title: 'TikTok/Reels script', prompt: 'Viết script video ngắn (30-45s) chủ đề [CHỦ ĐỀ]. Cấu trúc: hook 3s, body, CTA. Kèm shot list và overlay text.' },
  { id: 'con-pr', category: 'Content & Copy', title: 'Press release', prompt: 'Viết press release công bố [SỰ KIỆN/SẢN PHẨM] của [DOANH NGHIỆP]. Tuân thủ cấu trúc inverted pyramid, có quote CEO.' },
  { id: 'con-cold', category: 'Content & Copy', title: 'Cold email B2B', prompt: 'Viết 3 phiên bản cold email B2B từ [DOANH NGHIỆP] gửi cho [DECISION MAKER ở COMPANY X]. Personalization, value prop, soft ask.' },

  // Email & Communication
  { id: 'com-followup', category: 'Email & Communication', title: 'Follow-up sau meeting', prompt: 'Viết email follow-up sau buổi gặp [ĐỐI TÁC] về [CHỦ ĐỀ]. Tóm tắt agreement, next steps có deadline, lịch họp tiếp.' },
  { id: 'com-decline', category: 'Email & Communication', title: 'Từ chối lịch sự', prompt: 'Viết email từ chối [LỜI MỜI/ĐỀ NGHỊ] một cách lịch sự, để mở khả năng hợp tác trong tương lai. Không cứng nhắc, không lê thê.' },
  { id: 'com-proposal', category: 'Email & Communication', title: 'Proposal gửi khách', prompt: 'Soạn proposal qua email cho [KHÁCH HÀNG] đang quan tâm [DỊCH VỤ]. Gồm understanding, scope, timeline, pricing, social proof.' },
  { id: 'com-thanks', category: 'Email & Communication', title: 'Cảm ơn khách hàng', prompt: 'Viết email cảm ơn [KHÁCH HÀNG] vừa mua [SẢN PHẨM]. Nhấn vào trải nghiệm tiếp theo + onboarding step + đầu mối hỗ trợ.' },
  { id: 'com-apologize', category: 'Email & Communication', title: 'Xin lỗi khách hàng', prompt: 'Viết email xin lỗi khách hàng sau sự cố [VẤN ĐỀ]. Thừa nhận, chịu trách nhiệm, giải pháp đã làm, cam kết tương lai. Tránh lý do biện minh.' },
  { id: 'com-holiday', category: 'Email & Communication', title: 'Chúc dịp lễ', prompt: 'Viết email chúc [TẾT/NOEL/...] gửi cho khách hàng/đối tác. Ngắn, ấm áp, có call-out cá nhân hoá theo loại quan hệ.' },

  // Sáng tạo & Branding
  { id: 'br-tagline', category: 'Sáng tạo & Branding', title: 'Tagline thương hiệu', prompt: 'Đề xuất 10 tagline cho thương hiệu [TÊN] hoạt động trong [NGÀNH], mang giá trị cốt lõi [GIÁ TRỊ]. Đa dạng tone: cảm xúc, hài hước, mạnh mẽ.' },
  { id: 'br-story', category: 'Sáng tạo & Branding', title: 'Brand story', prompt: 'Viết brand story dài 300 từ cho [THƯƠNG HIỆU]: founder origin, vấn đề khám phá, sứ mệnh, vision 5 năm.' },
  { id: 'br-voice', category: 'Sáng tạo & Branding', title: 'Tone of voice guideline', prompt: 'Soạn tone of voice guideline cho [THƯƠNG HIỆU]: 4 attribute với do/don\'t, kèm ví dụ caption đúng và sai.' },
  { id: 'br-campaign', category: 'Sáng tạo & Branding', title: 'Big campaign concept', prompt: 'Đề xuất 3 concept big idea cho campaign [MỤC TIÊU] của [THƯƠNG HIỆU]. Mỗi concept: insight, big idea, key message, executional ideas.' },
  { id: 'br-naming', category: 'Sáng tạo & Branding', title: 'Đặt tên sản phẩm', prompt: 'Đề xuất 15 tên cho [SẢN PHẨM/DỊCH VỤ MỚI] thuộc [NGÀNH]. Chia thành 3 nhóm: descriptive, abstract, blend. Giải thích nghĩa, kiểm tra clash thương hiệu.' },
  { id: 'br-mood', category: 'Sáng tạo & Branding', title: 'Moodboard brief', prompt: 'Viết brief moodboard cho thương hiệu [TÊN]: 5 visual reference, color story, typography hướng, photography style.' },

  // Research & Data
  { id: 'res-survey', category: 'Research & Data', title: 'Khảo sát khách hàng', prompt: 'Thiết kế bảng khảo sát 15 câu cho khách hàng đã mua [SẢN PHẨM]. Mix định lượng + định tính. Phân tích kỳ vọng kết quả thu được.' },
  { id: 'res-insight', category: 'Research & Data', title: 'Khai thác insight', prompt: 'Từ dữ liệu sau: [PASTE DATA], rút ra 5 insight quan trọng và 3 action item ưu tiên.' },
  { id: 'res-market', category: 'Research & Data', title: 'Market report', prompt: 'Tóm tắt market report ngành [NGÀNH] tại [THỊ TRƯỜNG] 2024-2025: size, growth, key players, trend, threat, opportunity.' },
  { id: 'res-abtest', category: 'Research & Data', title: 'Thiết kế A/B test', prompt: 'Thiết kế A/B test cho [TÍNH NĂNG/COPY]. Variant A và B, hypothesis, metric chính, sample size, thời gian chạy, tiêu chí thắng.' },
  { id: 'res-traffic', category: 'Research & Data', title: 'Phân tích traffic web', prompt: 'Cho dữ liệu traffic [PASTE]. Phân tích nguồn, hành vi, conversion bottleneck. Đề xuất 5 thử nghiệm tối ưu.' },
  { id: 'res-listen', category: 'Research & Data', title: 'Social listening', prompt: 'Lập kế hoạch social listening cho thương hiệu [TÊN]: keyword theo dõi, kênh, tần suất, KPI sentiment.' },

  // Tâm lý khách hàng
  { id: 'psy-behavior', category: 'Tâm lý khách hàng', title: 'Phân tích hành vi mua hàng', prompt: 'Phân tích hành vi mua hàng của [PHÂN KHÚC] khi chọn [LOẠI SẢN PHẨM]: trigger, search, evaluation, decision, post-purchase.' },
  { id: 'psy-trigger', category: 'Tâm lý khách hàng', title: 'Emotional triggers', prompt: 'Liệt kê 10 emotional trigger mạnh nhất với [PHÂN KHÚC] khi tiếp xúc với [LOẠI SẢN PHẨM]. Mỗi trigger: cách sử dụng trong copy.' },
  { id: 'psy-hard', category: 'Tâm lý khách hàng', title: 'Xử lý khách hàng khó tính', prompt: 'Đưa ra script xử lý khách hàng đang [TÌNH HUỐNG]. Gồm lời mở, ack cảm xúc, giải thích, giải pháp, follow-up.' },
  { id: 'psy-b2bvsb2c', category: 'Tâm lý khách hàng', title: 'Khác biệt B2B vs B2C', prompt: 'So sánh hành vi mua giữa B2B và B2C với [LOẠI SẢN PHẨM]: decision flow, người ảnh hưởng, cảm xúc, dữ liệu cần.' },

  // Phát triển sản phẩm
  { id: 'prod-roadmap', category: 'Phát triển sản phẩm', title: 'Product roadmap 12 tháng', prompt: 'Vẽ roadmap 12 tháng cho [SẢN PHẨM]: theme mỗi quý, key feature, dependency, KPI thành công.' },
  { id: 'prod-feedback', category: 'Phát triển sản phẩm', title: 'Feedback loop', prompt: 'Thiết kế feedback loop cho [SẢN PHẨM]: nguồn thu thập, công cụ, quy trình triage, đóng vòng phản hồi cho user.' },
  { id: 'prod-rice', category: 'Phát triển sản phẩm', title: 'Ưu tiên RICE', prompt: 'Áp dụng RICE framework để ưu tiên backlog sau cho [SẢN PHẨM]: [LIST FEATURE]. Bảng đánh giá + diễn giải.' },
  { id: 'prod-beta', category: 'Phát triển sản phẩm', title: 'Beta launch plan', prompt: 'Lập kế hoạch beta launch cho [SẢN PHẨM/TÍNH NĂNG] trong 4 tuần: tiêu chí chọn beta user, kênh thu feedback, KPI, exit beta tiêu chí.' },
];
