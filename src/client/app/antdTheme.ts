/**
 * app/antdTheme.ts —— Ant Design 主题配置。
 *
 * 设计原则：**让 antd 组件自动继承现有界面的配色与圆角**，而不是把界面改成 antd 默认皮肤。
 * 因此这里把 styles/style.css 里的 CSS 变量（--accent / --ink / --line / --radius …）
 * 一一映射为 antd 的 design token；后续任何 antd 组件都会自动同色系，无需再逐个调样式。
 *
 * 注意：
 * 1. 不引入 `antd/dist/reset.css` —— 那会重置全局样式并改变现有布局；antd v6 的 CSS-in-JS
 *    只会注入组件自身样式，正好满足「布局不变」。
 * 2. 图标一律继续用 Lucide，不引入 @ant-design/icons；antd 组件里通过
 *    `character` / `prevIcon` / `closeIcon` 等属性传入 Lucide 组件。
 */
import type { ThemeConfig } from 'antd';

/** 与 style.css 的 --sans 保持一致 */
const SANS =
  '-apple-system,BlinkMacSystemFont,"PingFang SC","Hiragino Sans GB","Microsoft YaHei","Segoe UI",sans-serif';

export const antdTheme: ThemeConfig = {
  token: {
    /* 主色与语义色（= --accent / --green / --gold / --danger） */
    colorPrimary: '#3368a0',
    colorLink: '#3368a0',
    colorInfo: '#3368a0',
    colorSuccess: '#6d9c84',
    colorWarning: '#c79a3d',
    colorError: '#c0392b',

    /* 文字（= --ink / --ink-soft / --ink-faint） */
    colorText: '#2e4258',
    colorTextSecondary: '#5a6d7d',
    colorTextTertiary: '#94a1a3',
    colorTextQuaternary: '#94a1a3',

    /* 容器与背景（= --card / --bg / --bg-deep） */
    colorBgContainer: '#ffffff',
    colorBgElevated: '#ffffff',
    colorBgLayout: '#f2efe7',
    colorFillSecondary: '#e7e3d9',

    /* 描边（= --line） */
    colorBorder: '#dadbcf',
    colorBorderSecondary: '#dadbcf',

    /* 圆角与字体（= --radius / --sans） */
    borderRadius: 8,
    borderRadiusLG: 10,
    borderRadiusSM: 6,
    fontFamily: SANS,
    fontSize: 14,

    /* 阴影（= --shadow-lg，弹层类组件用） */
    boxShadowSecondary: '0 4px 10px rgba(46,66,88,.08), 0 20px 50px rgba(46,66,88,.16)',
  },
  components: {
    /* 分页：34px 方形按钮 · 8px 圆角 · 描边色与卡片一致（对齐 .page-btn） */
    Pagination: {
      itemSize: 34,
      itemSizeSM: 34,
      itemBg: '#ffffff',
      itemActiveBg: '#3368a0',
      itemLinkBg: '#ffffff',
      itemInputBg: '#ffffff',
      borderRadius: 8,
    },
    /* 评分：金色实心星（对齐 .stars .star.on） */
    Rate: {
      starColor: '#c79a3d',
      starBg: '#d8d9cd',
      starSize: 15,
    },
    /* 分段控件：药丸形外壳 + 白色滑块（对齐 .book-type-switch） */
    Segmented: {
      trackBg: '#e7e3d9',
      itemColor: '#5a6d7d',
      itemHoverColor: '#2e4258',
      itemSelectedBg: '#ffffff',
      itemSelectedColor: '#2e4258',
      trackPadding: 2,
      borderRadius: 999,
      borderRadiusSM: 999,
    },
    /* 气泡提示：深墨底 + 白字 + 8px 圆角（对齐 .btn-tooltip） */
    Tooltip: {
      colorBgSpotlight: '#2e4258',
      colorTextLightSolid: '#ffffff',
      borderRadius: 8,
      fontSize: 12.5,
    },
  },
};
