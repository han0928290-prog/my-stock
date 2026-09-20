// 追蹤筆記時間軸的分類與進度狀態（前後端共用）
export const CATEGORIES = ["EPS", "產能", "擴廠", "財測", "其他"] as const;
export const STATUSES = ["待追蹤", "符合預期", "超前", "落後"] as const;

export type Category = (typeof CATEGORIES)[number];
export type Status = (typeof STATUSES)[number];
