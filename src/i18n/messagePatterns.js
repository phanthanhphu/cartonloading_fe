// Backend error patterns; preserve captured business identifiers.
export const systemMessagePatterns = [
  {
    "source": "^Factory (F[1-9][0-9]*) cannot be deleted because it is used by: (.+)\\. Remove its assignments/dependencies first, or deactivate it\\.$",
    "vi": "Không thể xóa Factory {0} vì đang được sử dụng tại: {1}. Hãy gỡ các liên kết hoặc ngừng kích hoạt Factory.",
    "translateList": true
  },
  {
    "source": "^Shipping Schedule (.+) deleted\\. Original POs and cartons were kept\\.$",
    "vi": "Đã xóa lịch xuất hàng {0}. Các PO và carton gốc được giữ nguyên."
  },
  {
    "source": "^Shipping Schedule (.+) submitted successfully\\.$",
    "vi": "Đã chốt lịch xuất hàng {0}."
  },
  {
    "source": "^Shipping Schedule (.+) unsubmitted successfully\\.$",
    "vi": "Đã mở lại lịch xuất hàng {0}."
  },
  {
    "source": "^Saved (\\d+) PO\\(s\\) to Shipping Schedule (.+)\\.$",
    "vi": "Đã lưu {0} PO vào lịch xuất hàng {1}."
  },
  {
    "source": "^Added (\\d+) PO\\(s\\) to Shipping Schedule (.+)\\.$",
    "vi": "Đã thêm {0} PO vào lịch xuất hàng {1}."
  },
  {
    "source": "^PO (.+) removed from this Shipping Schedule only\\. Original PO kept\\.$",
    "vi": "Đã gỡ PO {0} khỏi lịch xuất hàng này, PO gốc được giữ nguyên."
  },
  {
    "source": "^Request failed with status code (\\d{3})$",
    "vi": "Yêu cầu không thành công (HTTP {0})."
  },
  {
    "source": "^Order Factory access denied: (.+)$",
    "vi": "Bạn không có quyền truy cập Factory của đơn hàng: {0}."
  },
  {
    "source": "^Weighing Factory access denied: (.+)$",
    "vi": "Bạn không có quyền truy cập Factory cân: {0}."
  },
  {
    "source": "^Invalid LULULEMON permission: (.+)$",
    "vi": "Quyền LULULEMON không hợp lệ: {0}."
  },
  {
    "source": "^Buyer not assigned: (.+)$",
    "vi": "Buyer chưa được phân công: {0}."
  },
  {
    "source": "^Invalid Weighing Factory code: (.+)$",
    "vi": "Mã Factory cân không hợp lệ: {0}."
  },
  {
    "source": "^Invalid Type permission for (.+)$",
    "vi": "Quyền Type không hợp lệ cho: {0}."
  },
  {
    "source": "^Order name already exists in Factory (.+)$",
    "vi": "Tên đơn hàng đã tồn tại ở Factory {0}."
  },
  {
    "source": "^timeout of (.+)ms exceeded$",
    "vi": "Kết nối quá thời gian chờ ({0} ms)."
  },
  {"source": "^Added (\\d+) PO\\(s\\) to Shipping Date (\\d{4}-\\d{2}-\\d{2}) for Factory (.+)$", "vi": "Đã thêm {0} PO vào ngày xuất hàng {1} của nhà máy {2}", "dateCaptures": [1]},
  {"source": "^Removed PO (.+) from Shipping Date (\\d{4}-\\d{2}-\\d{2}) for Factory (.+)$", "vi": "Đã gỡ PO {0} khỏi ngày xuất hàng {1} của nhà máy {2}", "dateCaptures": [1]},
  {"source": "^Submitted Shipping Schedule (\\d{4}-\\d{2}-\\d{2}) for Factory (.+)$", "vi": "Đã chốt lịch xuất hàng ngày {0} của nhà máy {1}", "dateCaptures": [0]},
  {"source": "^Unsubmitted Shipping Schedule (\\d{4}-\\d{2}-\\d{2}) for Factory (.+)$", "vi": "Đã mở lại lịch xuất hàng ngày {0} của nhà máy {1}", "dateCaptures": [0]},
  {"source": "^Deleted Shipping Date (\\d{4}-\\d{2}-\\d{2}) for Factory ([A-Za-z0-9_-]+)(?:\\. Original PO and carton records were kept\\.)?$", "vi": "Đã xóa ngày xuất hàng {0} của nhà máy {1}. PO và thùng gốc được giữ nguyên.", "dateCaptures": [0]},
  {"source": "^Added (\\d+) PO\\(s\\) to shipping date (\\d{4}-\\d{2}-\\d{2}) for Factory (.+)$", "vi": "Đã thêm {0} PO vào ngày xuất hàng {1} của nhà máy {2}", "dateCaptures": [1]},
  {"source": "^Deleted Shipping Date (\\d{4}-\\d{2}-\\d{2}) for Factory (.+?) \\(removed (\\d+) PO memberships; source POs kept\\)$", "vi": "Đã xóa ngày xuất hàng {0} của nhà máy {1} (gỡ {2} PO khỏi lịch; các PO gốc được giữ nguyên)", "dateCaptures": [0]}
];
