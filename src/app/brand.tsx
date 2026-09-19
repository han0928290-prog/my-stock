export const SITE_NAME = "我的股票摘要站";

export default function Brand({ size = "md" }: { size?: "md" | "lg" }) {
  const lg = size === "lg";
  return (
    <div className="flex items-center gap-3">
      <span
        aria-hidden
        className={`flex items-center justify-center rounded-xl font-serif font-bold text-[#16130a] ${
          lg ? "h-11 w-11 text-xl" : "h-9 w-9 text-base"
        }`}
        style={{
          background: "linear-gradient(135deg, #e6c882, #c9a04c)",
          boxShadow: "0 1px 0 rgba(255,255,255,.4) inset, 0 6px 14px -6px rgba(201,160,76,.8)",
        }}
      >
        股
      </span>
      <span className={`font-serif font-bold tracking-wide ${lg ? "text-2xl" : "text-lg"}`}>
        {SITE_NAME}
      </span>
    </div>
  );
}
