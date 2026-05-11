import type { PromptDefinition } from './index'

export const horoscopePaidPrompt: PromptDefinition = {
  system_prompt: `Bạn là chuyên gia tử vi và thần số học người Việt. Nhiệm vụ: phân tích tử vi năm hiện tại và dự báo vận hạn dựa trên con số thần số học. Viết bằng tiếng Việt, sâu sắc, cụ thể, cá nhân hoá từng khía cạnh cuộc sống. LUÔN trả về JSON hợp lệ, không kèm text nào ngoài JSON.

QUAN TRỌNG VỀ ĐỘ DÀI: Mỗi trường "description" hoặc "career" tối đa 3-4 câu (khoảng 60-80 từ). Mỗi mảng (strengths/challenges/keywords/lucky_numbers) tối đa 3 phần tử. Toàn bộ JSON phải hoàn chỉnh, không bị cắt giữa chừng.`,

  user_template: `Luận tử vi thần số học:

Họ tên: {{full_name}}, ngày sinh: {{birth_date}}, giới tính: {{gender}}
Số Đường Đời: {{life_path_number}} | Số Linh Hồn: {{soul_number}} | Số Nhân Cách: {{personality_number}} | Số Vận Mệnh: {{destiny_number}}
Năm dự báo: {{current_year}}

Tính số cá nhân năm {{current_year}} và phân tích vận hạn toàn diện.

Trả về JSON:
{
  "summary": "Nhận xét tổng quan 2-3 câu về năm {{current_year}}, đề cập tên, chủ đề chính của năm",
  "personal_year_number": <số cá nhân năm {{current_year}}, tính từ ngày sinh + năm hiện tại>,
  "sections": {
    "chu_de_nam": {
      "visible": true,
      "content": {
        "title": "Chủ đề năm {{current_year}}",
        "description": "Phân tích chi tiết chủ đề và năng lượng chủ đạo của năm {{current_year}} dựa trên số cá nhân năm, những cơ hội và thách thức lớn",
        "keywords": ["chủ đề 1", "chủ đề 2", "chủ đề 3", "chủ đề 4"],
        "strengths": ["cơ hội lớn 1", "cơ hội 2", "cơ hội 3"],
        "challenges": ["thách thức cần vượt qua 1", "thách thức 2"]
      }
    },
    "su_nghiep_tai_chinh": {
      "visible": true,
      "content": {
        "title": "Sự nghiệp & Tài chính",
        "description": "Dự báo chi tiết về sự nghiệp, công việc và tài chính trong năm {{current_year}}, tháng đỉnh cao và tháng cần thận trọng",
        "career": "Lời khuyên cụ thể về sự nghiệp, bước đi nên thực hiện trong năm"
      }
    },
    "tinh_duyen_gia_dinh": {
      "visible": true,
      "content": {
        "title": "Tình duyên & Gia đình",
        "description": "Dự báo đời sống tình cảm, hôn nhân và gia đình trong năm {{current_year}}",
        "strengths": ["thuận lợi tình cảm 1", "thuận lợi 2"],
        "challenges": ["cần chú ý trong tình cảm 1", "cần chú ý 2"]
      }
    },
    "suc_khoe": {
      "visible": true,
      "content": {
        "title": "Sức khoẻ",
        "description": "Dự báo sức khoẻ tổng thể, những điểm cần lưu ý và cách duy trì thể chất — tinh thần tốt trong năm {{current_year}}"
      }
    },
    "thang_tot_va_nen_tranh": {
      "visible": true,
      "content": {
        "title": "Tháng đỉnh cao & Tháng cần thận trọng",
        "description": "Các tháng thuận lợi nhất để hành động lớn và các tháng nên giữ bình tĩnh, tránh rủi ro",
        "lucky_numbers": [<3-5 con số may mắn trong năm {{current_year}}>]
      }
    }
  }
}`,
}
