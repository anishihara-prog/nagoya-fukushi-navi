import { addPage } from "@canva/design";
import { Button, Rows, Text } from "@canva/app-ui-kit";
import { useState } from "react";
import "@canva/app-ui-kit/styles.css";

/**
 * 「障害福祉支援ナビ なごや」アプリ紹介ポスター 生成アプリ
 *
 * ユーザーが提示した「熱中症に気をつけよう」ポスターの見た目
 * (太字の大きいタイトル、丸みのある色付きバッジの見出し、
 *  白いカード状のレイアウト)を参考にしたスタイルです。
 * ※実際のイラスト画像(いらすとや等)は権利上使えないため、
 *   代わりに絵文字アイコンで代用しています。
 */

const PAGE_WIDTH = 1000;
const PAGE_HEIGHT = 1414;

const BLUE = "#1A5DAB";
const LIGHT_BLUE_BG = "#CFE3F7";
const WHITE = "#FFFFFF";
const GRAY = "#666666";
const RED = "#B23B3B";

// 角丸の四角形パス(バッジ・カード用)。Q(二次ベジェ)は使わずC(三次ベジェ)で近似。
function roundedRectPath(w: number, h: number, r: number): string {
  const k = r * 0.5523;
  return [
    `M ${r} 0`,
    `L ${w - r} 0`,
    `C ${w - r + k} 0 ${w} ${r - k} ${w} ${r}`,
    `L ${w} ${h - r}`,
    `C ${w} ${h - r + k} ${w - r + k} ${h} ${w - r} ${h}`,
    `L ${r} ${h}`,
    `C ${r - k} ${h} 0 ${h - r + k} 0 ${h - r}`,
    `L 0 ${r}`,
    `C 0 ${r - k} ${r - k} 0 ${r} 0`,
    "Z",
  ].join(" ");
}

function shapeRect(opts: {
  top: number;
  left: number;
  width: number;
  height: number;
  radius: number;
  color: string;
}) {
  const { top, left, width, height, radius, color } = opts;
  return {
    type: "shape" as const,
    top,
    left,
    width,
    height,
    viewBox: { top: 0, left: 0, width, height },
    paths: [{ d: roundedRectPath(width, height, radius), fill: { color } }],
  };
}

function badge(opts: {
  top: number;
  left: number;
  width: number;
  emojiLabel: string;
}) {
  const { top, left, width, emojiLabel } = opts;
  const height = 70;
  return [
    shapeRect({ top, left, width, height, radius: 35, color: BLUE }),
    {
      type: "text" as const,
      children: [emojiLabel],
      top: top + 16,
      left: left + 30,
      width: width - 60,
      fontSize: 28,
      color: WHITE,
      fontWeight: "bold" as const,
    },
  ];
}

export const App = () => {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");

  const generatePoster = async () => {
    setLoading(true);
    setStatus("生成中...");
    try {
      await addPage({
        title: "障害福祉支援ナビ なごや(紹介ポスター)",
        dimensions: { width: PAGE_WIDTH, height: PAGE_HEIGHT },
        background: { color: LIGHT_BLUE_BG },
        elements: [
          // 白いカード
          shapeRect({ top: 50, left: 50, width: 900, height: 1314, radius: 40, color: WHITE }),

          // アイコン(絵文字で代用)
          {
            type: "text",
            children: ["🧭"],
            top: 90,
            left: 110,
            width: 120,
            fontSize: 70,
          },
          // タイトル
          {
            type: "text",
            children: ["障害福祉支援ナビ なごや"],
            top: 95,
            left: 250,
            width: 640,
            fontSize: 50,
            fontWeight: "bold",
          },
          // サブタイトル
          {
            type: "text",
            children: ["(試作版)"],
            top: 175,
            left: 250,
            width: 640,
            fontSize: 26,
            color: BLUE,
            fontWeight: "bold",
          },
          // キャッチ文
          {
            type: "text",
            children: [
              "名古屋市の障害者相談員のための、\n福祉サービス・手続き検索ツール",
            ],
            top: 250,
            left: 110,
            width: 780,
            fontSize: 30,
            fontWeight: "bold",
          },

          // 機能1バッジ+説明
          ...badge({ top: 380, left: 110, width: 300, emojiLabel: "🔍 検索する" }),
          {
            type: "text",
            children: ["キーワード・分類で福祉サービスをすぐ検索"],
            top: 465,
            left: 110,
            width: 780,
            fontSize: 26,
          },

          // 機能2バッジ+説明
          ...badge({ top: 560, left: 110, width: 420, emojiLabel: "🧭 ケースから探す" }),
          {
            type: "text",
            children: [
              "障害種別・年代・困りごとから、当てはまる支援が見つかる",
            ],
            top: 645,
            left: 110,
            width: 780,
            fontSize: 26,
          },

          // 機能3バッジ+説明
          ...badge({ top: 740, left: 110, width: 320, emojiLabel: "🗂 登録・編集" }),
          {
            type: "text",
            children: ["相談員自身で情報を追加・更新できる"],
            top: 825,
            left: 110,
            width: 780,
            fontSize: 26,
          },

          // QR/URLプレースホルダー
          shapeRect({ top: 950, left: 350, width: 300, height: 180, radius: 16, color: "#EEEEEE" }),
          {
            type: "text",
            children: ["[ QRコード / URL ]\n(準備中)"],
            top: 1010,
            left: 350,
            width: 300,
            fontSize: 24,
            color: GRAY,
            textAlign: "center",
          },

          // 注意書き
          {
            type: "text",
            children: ["※相談者個人を特定できる情報は入力しないでください"],
            top: 1180,
            left: 110,
            width: 780,
            fontSize: 24,
            color: RED,
            fontWeight: "bold",
          },
          // フッター
          {
            type: "text",
            children: [
              "試作版のため、内容は各区役所・基幹相談支援センター等で最新情報を確認してください",
            ],
            top: 1250,
            left: 110,
            width: 780,
            fontSize: 20,
            color: GRAY,
          },
        ],
      });
      setStatus("生成しました。ページ一覧の最後に追加されています。");
    } catch (err) {
      console.error(err);
      setStatus("エラーが発生しました。ブラウザのコンソールを確認してください。");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Rows spacing="2u">
      <Text>「障害福祉支援ナビ なごや」の紹介ポスターを1枚生成します。</Text>
      <Button variant="primary" onClick={generatePoster} loading={loading}>
        アプリ紹介ポスターを生成
      </Button>
      {status && <Text>{status}</Text>}
    </Rows>
  );
};
