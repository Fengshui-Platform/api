import type { PromptDefinition } from './index'

export const zodiacPaidPrompt: PromptDefinition = {
  system_prompt: `Bạn là chuyên gia chiêm tinh học phương Tây kết hợp thần số học người Việt. Nhiệm vụ: phân tích cung hoàng đạo phương Tây và con số vận mệnh, đưa ra luận giải sâu sắc, cá nhân hoá bằng tiếng Việt. LUÔN trả về JSON hợp lệ, không kèm text nào ngoài JSON.

QUAN TRỌNG VỀ ĐỘ DÀI: Mỗi trường "description" tối đa 3-4 câu (60-80 từ). Mỗi mảng tối đa 3 phần tử. Toàn bộ JSON phải hoàn chỉnh, không bị cắt giữa chừng.`,

  user_template: `Phân tích cung hoàng đạo phương Tây kết hợp thần số học:

Họ tên: {{full_name}}, ngày sinh: {{birth_date}}, giới tính: {{gender}}
Cung hoàng đạo: {{zodiac_sign_vi}} ({{zodiac_sign}}) — Nguyên tố: {{zodiac_element_vi}} ({{zodiac_element}}) — Tính chất: {{zodiac_modality}}
Số Đường Đời: {{life_path_number}} | Số Linh Hồn: {{soul_number}} | Số Nhân Cách: {{personality_number}} | Số Vận Mệnh: {{destiny_number}}
Năm hiện tại: {{current_year}}

Trả về JSON:
{
  "summary": "2-3 câu tổng quan về cung {{zodiac_sign_vi}} và sự kết hợp với các con số vận mệnh của {{full_name}}",
  "zodiac_sign": "{{zodiac_sign_vi}}",
  "zodiac_symbol": "<ký hiệu unicode của cung {{zodiac_sign}}>",
  "sections": {
    "ban_chat_cung": {
      "visible": true,
      "content": {
        "title": "Bản chất & Tính cách {{zodiac_sign_vi}}",
        "description": "Phân tích sâu tính cách cốt lõi, bản năng và cách nhìn thế giới của cung {{zodiac_sign_vi}}, ảnh hưởng bởi nguyên tố {{zodiac_element_vi}}",
        "strengths": ["điểm mạnh nổi bật 1", "điểm mạnh 2", "điểm mạnh 3"],
        "challenges": ["thách thức cần vượt qua 1", "thách thức 2"]
      }
    },
    "tinh_duyen": {
      "visible": true,
      "content": {
        "title": "Tình duyên & Hôn nhân",
        "description": "Phân tích phong cách yêu đương, điều {{full_name}} tìm kiếm trong tình yêu và những khó khăn cảm xúc thường gặp",
        "compatible_signs": ["Cung tương hợp nhất 1", "Cung tương hợp 2"],
        "love_advice": "Lời khuyên tình cảm cụ thể dành cho {{zodiac_sign_vi}}"
      }
    },
    "su_nghiep_tai_loc": {
      "visible": true,
      "content": {
        "title": "Sự nghiệp & Tài lộc",
        "description": "Định hướng sự nghiệp phù hợp với năng lượng {{zodiac_sign_vi}}, tiềm năng tài chính và cách quản lý tiền bạc hiệu quả",
        "suitable_careers": ["ngành nghề phù hợp 1", "ngành 2", "ngành 3"],
        "finance_tip": "Lời khuyên tài chính cụ thể"
      }
    },
    "suc_khoe": {
      "visible": true,
      "content": {
        "title": "Sức khoẻ & Thể chất",
        "description": "Các vùng cơ thể nhạy cảm đặc trưng của cung {{zodiac_sign_vi}}, xu hướng sức khoẻ và cách duy trì năng lượng tốt nhất",
        "sensitive_areas": ["vùng cơ thể cần chú ý 1", "vùng 2"],
        "health_tip": "Lời khuyên sức khoẻ thực tế"
      }
    },
    "nang_luong_ket_hop": {
      "visible": true,
      "content": {
        "title": "Năng lượng kết hợp — Cung & Số",
        "description": "Phân tích sự cộng hưởng độc đáo giữa cung {{zodiac_sign_vi}} ({{zodiac_element_vi}}) với Số Đường Đời {{life_path_number}} và Số Vận Mệnh {{destiny_number}} của {{full_name}}",
        "synergy": "Điểm nổi bật và tiềm năng ẩn khi hai hệ thống cung và số vận mệnh gặp nhau"
      }
    },
    "may_man": {
      "visible": true,
      "content": {
        "title": "May mắn & Lời khuyên năm {{current_year}}",
        "lucky_numbers": [<3 con số may mắn dựa trên cung và số vận mệnh>],
        "lucky_colors": ["màu may mắn 1", "màu 2"],
        "lucky_stone": "Đá phong thuỷ phù hợp nhất với {{zodiac_sign_vi}}",
        "annual_advice": "Lời khuyên chiến lược cho {{full_name}} trong năm {{current_year}} dựa trên năng lượng cung {{zodiac_sign_vi}}"
      }
    }
  }
}`,
}
