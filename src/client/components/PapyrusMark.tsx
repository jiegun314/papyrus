/**
 * components/PapyrusMark.tsx —— 纸莎草卷轴徽记（网站标题品牌图标）。
 * 图形裁剪自 favicon.svg（去掉其自带的小字号 PAPYRUS 字标，避免顶栏缩小时糊成一团），
 * 描边使用 currentColor，随使用处的文字颜色（如 --accent）自动着色。
 */
export function PapyrusMark({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="24 21 153 137"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      role="img"
      aria-label="Papyrus 卷轴徽记"
    >
      <g transform="translate(100,100)">
        {/* 卷轴外轮廓 */}
        <path
          d="M-55,-55 C-55,-65 -45,-70 -35,-70 L35,-70 C45,-70 55,-65 55,-55 L55,35 C55,45 45,50 35,50 L-35,50 C-45,50 -55,45 -55,35 Z"
          strokeWidth="2.5"
        />
        {/* 卷轴内框 */}
        <path
          d="M-48,-50 C-48,-58 -40,-62 -30,-62 L30,-62 C40,-62 48,-58 48,-50 L48,30 C48,38 40,42 30,42 L-30,42 C-40,42 -48,38 -48,30 Z"
          strokeWidth="1"
        />
        {/* 卷轴杆 */}
        <ellipse cx="-62" cy="-10" rx="5" ry="32" strokeWidth="2" />
        <ellipse cx="62" cy="-10" rx="5" ry="32" strokeWidth="2" />
        <path d="M-67,-35 L-57,-35 M-67,15 L-57,15 M57,-35 L67,-35 M57,15 L67,15" strokeWidth="1" />
        {/* 横向纹理 */}
        <path d="M-40,-45 L40,-45 M-42,-30 L42,-30 M-44,-15 L44,-15 M-45,0 L45,0 M-44,15 L44,15 M-42,30 L42,30" strokeWidth="0.6" />
        {/* 纵向纹理 */}
        <path d="M-25,-62 L-25,42 M0,-62 L0,42 M25,-62 L25,42" strokeWidth="0.4" />
        {/* 编织纹理 */}
        <path
          d="M-15,-38 L-5,-28 M-5,-38 L-15,-28 M5,-38 L15,-28 M15,-38 L5,-28 M-15,-8 L-5,2 M-5,-8 L-15,2 M5,-8 L15,2 M15,-8 L5,2 M-15,22 L-5,32 M-5,22 L-15,32 M5,22 L15,32 M15,22 L5,32"
          strokeWidth="0.5"
        />
        {/* 荷鲁斯之眼 */}
        <path d="M-18,-8 Q0,-18 18,-8 Q0,2 -18,-8 Z" strokeWidth="1.2" />
        <circle cx="0" cy="-8" r="3.5" strokeWidth="1" />
        <circle cx="0" cy="-8" r="1.5" fill="currentColor" stroke="none" />
        {/* 羽毛 */}
        <path d="M-12,12 Q-6,8 0,14 Q6,8 12,12" strokeWidth="1" />
        <path d="M-8,20 Q-4,16 0,22 Q4,16 8,20" strokeWidth="0.7" />
      </g>
    </svg>
  );
}
