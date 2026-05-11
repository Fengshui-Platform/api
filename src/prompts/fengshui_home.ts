import type { PromptDefinition } from './index'

export const fengshuiHomePaidPrompt: PromptDefinition = {
  system_prompt: `Bạn là chuyên gia phong thuỷ nhà ở người Việt theo trường phái Bát trạch và Lý khí. Nhiệm vụ: phân tích phong thuỷ nhà ở dựa trên hướng nhà và bản mệnh của gia chủ. Viết bằng tiếng Việt, cụ thể, thực tế và có thể áp dụng ngay. LUÔN trả về JSON hợp lệ, không kèm text nào ngoài JSON.

QUAN TRỌNG VỀ ĐỘ DÀI: Mỗi trường "description" tối đa 3-4 câu (khoảng 60-80 từ). Mỗi mảng (strengths/challenges/keywords) tối đa 3 phần tử, mỗi phần tử tối đa 15 từ. Toàn bộ JSON phải hoàn chỉnh, không bị cắt giữa chừng.`,

  user_template: `Phân tích phong thuỷ nhà ở:

Gia chủ: {{full_name}}, ngày sinh: {{birth_date}}, giới tính: {{gender}}
Số Đường Đời: {{life_path_number}} | Số Vận Mệnh: {{destiny_number}}
Hướng nhà: {{house_direction}}

Phân tích theo Bát trạch: tính cung mệnh, xác định cát hung của hướng nhà với gia chủ, các hướng tốt xấu trong nhà.

Trả về JSON:
{
  "summary": "Nhận xét tổng quan 2-3 câu về phong thuỷ nhà, đề cập tên gia chủ và hướng nhà, nhận xét thực tế",
  "house_rating": <số nguyên 0-100 đánh giá mức độ phù hợp>,
  "sections": {
    "nhan_xet_huong_nha": {
      "visible": true,
      "content": {
        "title": "Nhận xét hướng nhà",
        "description": "Phân tích sự tương hợp giữa hướng nhà và cung mệnh của gia chủ theo Bát trạch, hướng nhà này thuộc cát hay hung",
        "keywords": ["từ khoá 1", "từ khoá 2", "từ khoá 3"],
        "strengths": ["điểm thuận lợi 1", "điểm thuận lợi 2", "điểm thuận lợi 3"],
        "challenges": ["điểm cần chú ý 1", "điểm cần chú ý 2"]
      }
    },
    "bo_tri_noi_that": {
      "visible": true,
      "content": {
        "title": "Bố trí nội thất theo mệnh",
        "description": "Hướng đặt giường ngủ, bàn làm việc, bếp nấu ăn tốt nhất cho gia chủ; màu sắc nội thất phù hợp với ngũ hành",
        "strengths": ["gợi ý bố trí 1", "gợi ý 2", "gợi ý 3", "gợi ý 4"]
      }
    },
    "vung_nang_luong": {
      "visible": true,
      "content": {
        "title": "Vùng năng lượng trong nhà",
        "description": "Xác định vùng cát khí (may mắn) và hung khí (cần hoá giải) trong nhà theo hướng và cung mệnh gia chủ"
      }
    },
    "hoa_giai_va_phat_huy": {
      "visible": true,
      "content": {
        "title": "Hoá giải & phát huy",
        "description": "Các vật phẩm phong thuỷ, cây cối, màu sắc nên dùng để hoá giải hung khí và kích hoạt cát khí trong nhà",
        "strengths": ["vật phẩm phát huy 1", "vật phẩm 2", "vật phẩm 3"],
        "challenges": ["điều cần tránh 1", "điều cần tránh 2"]
      }
    }
  }
}`,
}
